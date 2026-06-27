import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy initialisation of Gemini client to prevent startup crash if API key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please check your Secrets in Settings.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Config check
app.get("/api/config", (req, res) => {
  res.json({
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// TTS Speech generation endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice, style, speed } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Будь ласка, введіть текст для озвучення." });
    }
    
    if (text.length > 5000) {
      return res.status(400).json({ error: "Текст занадто довгий (максимум 5000 символів)." });
    }

    const ai = getGeminiClient();

    // Map emotion styles
    let styleInstruction = "Say";
    if (style === "cheerful") styleInstruction += " cheerfully";
    else if (style === "sad") styleInstruction += " sadly";
    else if (style === "excited") styleInstruction += " excitedly";
    else if (style === "whispering") styleInstruction += " in a quiet whisper";
    else if (style === "dramatic") styleInstruction += " dramatically";
    else if (style === "serious") styleInstruction += " seriously and professionally";
    else if (style === "calm") styleInstruction += " calmly and softly";
    else styleInstruction += " clearly";

    // Map speed configurations
    if (speed === "slow") styleInstruction += " and slowly";
    else if (speed === "fast") styleInstruction += " and fast";

    const promptText = `${styleInstruction}: ${text}`;
    const voiceName = voice || "Zephyr"; // Puck, Charon, Kore, Fenrir, Zephyr

    console.log(`Generating speech via gemini-3.1-flash-tts-preview: voice=${voiceName}, instruction="${styleInstruction}"`);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("Не вдалося згенерувати аудіо: ШІ не повернув звукові дані.");
    }

    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("Помилка генерації TTS:", error);
    res.status(500).json({ error: error?.message || "Помилка при озвученні тексту" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
