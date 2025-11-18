import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import Twilio from "twilio";

const app = express();
const { twiml } = Twilio;

app.use(bodyParser.urlencoded({ extended: false }));

// OpenAI Init
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Start point (first message)
app.post("/ai-call", async (req, res) => {
  const response = new twiml.VoiceResponse();

  const gather = response.gather({
    input: "speech",
    action: "/process-voice",
    speechTimeout: "auto",
  });

  gather.say("Hello! I am your AI assistant. How can I help you today?");

  res.type("text/xml");
  res.send(response.toString());
});

// Process caller's speech
app.post("/process-voice", async (req, res) => {
  const userSpeech = req.body.SpeechResult || "I didn't hear anything.";

  const response = new twiml.VoiceResponse();

  try {
    // Send user speech to OpenAI
    const aiReply = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Speak short, assistant-style responses." },
        { role: "user", content: userSpeech }
      ]
    });

    const answer = aiReply.choices[0].message.content;

    // Continue conversation
    const gather = response.gather({
      input: "speech",
      action: "/process-voice",
      speechTimeout: "auto"
    });

    gather.say(answer);

  } catch (error) {
    response.say("Sorry, an error occurred.");
  }

  res.type("text/xml");
  res.send(response.toString());
});

// Server
app.listen(process.env.PORT || 3000);
