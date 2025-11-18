import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import Twilio from "twilio";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Twilio (CJS helper, so use default import)
const { twiml } = Twilio;

// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors()); // so modmemory.com frontend can call Railway backend

// OpenAI init
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get("/", (req, res) => {
  res.send("MODAI Server is running ✔");
});

/**
 * STEP 1: Start of the call (inbound or outbound)
 * Twilio hits this URL when the call starts.
 */
app.post("/ai-call", async (req, res) => {
  const response = new twiml.VoiceResponse();

  const gather = response.gather({
    input: "speech",
    action: "/process-voice",
    speechTimeout: "auto",
  });

  // Optional: personalise from query params (name, service)
  const name = req.query.name || "there";
  const service = req.query.service || "our services";

  gather.say(`Hello ${name}! I am your AI assistant from ModMemory. Thanks for your interest in ${service}. How can I help you today?`);

  res.type("text/xml");
  res.send(response.toString());
});

/**
 * STEP 2: Twilio sends recognized speech here.
 * We send it to OpenAI, get reply, and ask again.
 */
app.post("/process-voice", async (req, res) => {
  const userSpeech = req.body.SpeechResult || "I didn't hear anything.";
  console.log("User said:", userSpeech);

  const response = new twiml.VoiceResponse();

  try {
    const aiReply = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a friendly voice assistant representing ModMemory, a web & AI solutions agency. Answer briefly and keep the conversation natural."
        },
        { role: "user", content: userSpeech }
      ]
    });

    const answer = aiReply.choices[0].message.content;

    const gather = response.gather({
      input: "speech",
      action: "/process-voice",
      speechTimeout: "auto"
    });

    gather.say(answer);

  } catch (error) {
    console.error("AI Error:", error);
    response.say("Sorry, an error occurred.");
  }

  res.type("text/xml");
  res.send(response.toString());
});

/**
 * STEP 3: OUTBOUND CALL TRIGGER
 * This is what your landing page will call.
 * Body: { phone: "+1...", name: "John", service: "AI Website" }
 */
app.post("/make-call", async (req, res) => {
  try {
    const { phone, name, service } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: "phone is required" });
    }

    const toNumber = phone.trim();

    // Twilio REST client
    const twilioClient = Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Build URL for AI call (with optional personalization)
    const baseUrl = "https://modai-production.up.railway.app"; // your Railway URL
    const params = new URLSearchParams();
    if (name) params.append("name", name);
    if (service) params.append("service", service);

    const aiCallUrl = `${baseUrl}/ai-call${
      params.toString() ? "?" + params.toString() : ""
    }`;

    console.log("Placing outbound call to:", toNumber, "via", aiCallUrl);

    const call = await twilioClient.calls.create({
      to: toNumber,
      from: process.env.TWILIO_NUMBER,
      url: aiCallUrl,
    });

    return res.json({
      success: true,
      callSid: call.sid
    });

  } catch (err) {
    console.error("Error in /make-call:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MODAI server running on port ${PORT}`);
});
