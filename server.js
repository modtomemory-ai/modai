const express = require("express");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PUBLIC_HOST = process.env.PUBLIC_HOST || "modai-production.up.railway.app";

// Simple health-check
app.get("/", (req, res) => {
  res.send("OK – modai voice server running");
});

// 👉 Twilio webhook – returns TwiML
app.post("/ai-call", (req, res) => {
  const twiml = `
    <Response>
      <Say voice="Polly.Joanna">Connecting you now.</Say>
      <Connect>
        <Stream url="wss://${PUBLIC_HOST}/ws" />
      </Connect>
    </Response>
  `;
  res.type("text/xml");
  res.send(twiml.trim());
});

// 👉 WebSocket server (Twilio <-> OpenAI Realtime)
const wss = new WebSocket.Server({ noServer: true });

wss.on("connection", (ws) => {
  console.log("✅ Twilio WebSocket connected");

  const ai = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  ai.on("open", () => {
    console.log("✅ OpenAI Realtime connected");
    ai.send(
      JSON.stringify({
        type: "session.start",
        instructions: "You are a helpful voice assistant on the phone.",
      })
    );
  });

  // OpenAI → Twilio
  ai.on("message", (data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });

  // Twilio → OpenAI
  ws.on("message", (data) => {
    if (ai.readyState === WebSocket.OPEN) ai.send(data);
  });

  ws.on("close", () => ai.close());
  ai.on("close", () => ws.close());
});

// 👉 Attach WebSocket upgrade handler
const server = app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});
