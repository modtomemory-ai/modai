import express from "express";
import bodyParser from "body-parser";
import { OpenAI } from "openai";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ---------- Root Test ----------
app.get("/", (req, res) => {
  res.send("MODAI Server is running ✔️");
});

// ---------- AI CALL ROUTE ----------
app.post("/ai-call", async (req, res) => {
  try {
    console.log("Twilio Request Received:", req.body);

    const clientMessage = req.body.SpeechResult || "No speech detected";

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const aiReply = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: clientMessage },
      ],
    });

    const replyText = aiReply.choices[0].message.content;

    const twiml = `
      <Response>
        <Say voice="Polly.Joanna">${replyText}</Say>
      </Response>
    `;

    res.type("text/xml");
    res.send(twiml);

  } catch (err) {
    console.error("AI-Call Error:", err);
    res.type("text/xml");
    res.send(`
      <Response>
        <Say>Sorry, an error happened.</Say>
      </Response>
    `);
  }
});

// ---------- Start App ----------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server started on port", port);
});
