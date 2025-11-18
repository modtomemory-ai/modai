import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import { twiml } from "twilio";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Initialize OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Home
app.get("/", (req, res) => {
  res.send("MODAI Server is running ✔");
});

// Twilio webhook
app.post("/ai-call", async (req, res) => {
  const response = new twiml.VoiceResponse();

  try {
    const prompt = "Act like a helpful AI assistant on a call.";

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Caller said something." }
      ]
    });

    const aiMessage = completion.choices[0].message.content;

    response.say(aiMessage);
  } catch (err) {
    console.error("AI Error:", err);

    response.say("Sorry, an error happened.");
  }

  res.type("text/xml");
  res.send(response.toString());
});

app.listen(PORT, () =>
  console.log(`🚀 MODAI server running on port ${PORT}`)
);
