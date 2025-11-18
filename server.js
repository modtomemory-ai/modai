import express from "express";
import { WebSocketServer } from "ws";
import twilio from "twilio";
import bodyParser from "body-parser";
import { RealtimeClient } from "@openai/realtime-api";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ---------- TWILIO WEBHOOK ----------
app.post("/ai-call", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const connect = twiml.connect();
  connect.stream({
    url: "wss://modai-production.up.railway.app/ai-stream"
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

// ---------- WEBSOCKET SERVER ----------
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (ws) => {
  console.log("Twilio Stream Connected ✔");

  // OpenAI realtime client
  const client = new RealtimeClient({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-realtime-preview-2024-12-17",
  });

  await client.connect();

  client.on("response.output_text.delta", (event) => {
    ws.send(JSON.stringify({
      event: "media",
      media: {
        payload: Buffer.from(event.delta).toString("base64")
      }
    }));
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    if (msg.event === "media") {
      client.inputAudio(Buffer.from(msg.media.payload, "base64"));
    }
  });

  ws.on("close", () => {
    console.log("Twilio Stream Disconnected ❌");
    client.disconnect();
  });
});

// ---------- UPGRADE HTTP → WS ----------
const server = app.listen(process.env.PORT || 3000, () => {
  console.log("MODAI Server is running");
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ai-stream") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});
