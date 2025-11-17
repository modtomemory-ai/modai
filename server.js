import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// Twilio webhook
app.post("/ai-call", (req, res) => {
  const twiml = `
    <Response>
      <Say voice="Polly.Joanna">Connecting you now.</Say>
      <Connect>
       <Stream url="wss://${process.env.RENDER_EXTERNAL_HOSTNAME}/ws" />

      </Connect>
    </Response>
  `;
  res.type("text/xml");
  res.send(twiml);
});

// WebSocket between Twilio <-> OpenAI Realtime
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (ws) => {
  console.log("Twilio Connected!");

  const ai = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  ai.on("open", () => {
    console.log("OpenAI Connected!");
    ai.send(JSON.stringify({
      type: "session.start"
    }));
  });

  ai.on("message", (msg) => {
    ws.send(msg);
  });

  ws.on("message", (msg) => {
    ai.send(msg);
  });

  ws.on("close", () => ai.close());
});

// Needed for Render
const server = app.listen(process.env.PORT || 10000);

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});
