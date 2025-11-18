import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import Twilio from "twilio";

const app = express();
const PORT = process.env.PORT || 3000;

// Twilio uses CommonJS inside, so we must do default import
const { twiml } = Twilio;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Initialize OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get("/", (req, res) => {
  res.send("MODAI Server is running ✔");
});

// Twilio AI Call Webhook
app.post("/ai-call", async (req, res) => {
  const response = new twiml.VoiceResponse();

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Respond like a polite AI voice assistant." },
        { role: "user", content: "Caller spoke something." }
      ]
    });

    const answer = completion.choices[0].message.content;
    response.say(answer);

  } catch (error) {
    console.error("AI Error:", error);
    response.say("Sorry, an error occurred.");
  }

  res.type("text/xml");
  res.send(response.toString());
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 MODAI server running on port ${PORT}`);
});
