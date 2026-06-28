import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = 3000;

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const BYTES_PER_SAMPLE = BIT_DEPTH / 8;

app.use(express.json({ limit: "15mb" }));

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please check your Secrets in Settings.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiClient;
}

type Segment = { type: "text"; content: string } | { type: "pause"; seconds: number };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const parts = text.split(/\[пауза:\s*(\d+(?:\.\d+)?)\]/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const trimmed = parts[i].trim();
      if (trimmed) segments.push({ type: "text", content: trimmed });
    } else {
      const seconds = parseFloat(parts[i]);
      if (seconds > 0) segments.push({ type: "pause", seconds });
    }
  }
  return segments;
}

function buildStyleInstruction(style: string, speed: string): string {
  let instruction = "Say";
  if (style === "cheerful") instruction += " cheerfully";
  else if (style === "sad") instruction += " sadly";
  else if (style === "excited") instruction += " excitedly";
  else if (style === "whispering") instruction += " in a quiet whisper";
  else if (style === "dramatic") instruction += " dramatically";
  else if (style === "serious") instruction += " seriously and professionally";
  else if (style === "calm") instruction += " calmly and softly";
  else instruction += " clearly";

  if (speed === "slow") instruction += " and slowly";
  else if (speed === "fast") instruction += " and fast";
  return instruction;
}

function buildWavHeader(dataLength: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BIT_DEPTH, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function generateSilence(seconds: number): Buffer {
  const numBytes = Math.floor(seconds * SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE);
  return Buffer.alloc(numBytes);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function generateSpeechPcm(ai: GoogleGenAI, text: string, voice: string, styleInstruction: string): Promise<Buffer> {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `${styleInstruction}: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });
    const candidates = (response as any).candidates;
    const part = candidates?.[0]?.content?.parts?.[0];
    const b64: string | undefined = part?.inlineData?.data;
    const finishReason = candidates?.[0]?.finishReason;
    console.log(`  [${attempt}/${maxRetries}] "${text.substring(0,30)}" finish=${finishReason} hasData=${!!b64}`);
    if (b64) return Buffer.from(b64, "base64");
    if (attempt < maxRetries) await sleep(1500 * attempt);
  }
  throw new Error(`Не вдалось отримати аудіо після ${maxRetries} спроб: ${text.substring(0, 40)}`);
}

app.get("/api/config", (req, res) => {
  res.json({ hasApiKey: !!process.env.GEMINI_API_KEY });
});

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
    const voiceName = voice || "Zephyr";
    const styleInstruction = buildStyleInstruction(style, speed);
    const hasPauses = /\[пауза:\s*\d+/.test(text);

    let pcmChunks: Buffer[];

    if (!hasPauses) {
      console.log(`TTS (single): voice=${voiceName}`);
      const pcm = await generateSpeechPcm(ai, text, voiceName, styleInstruction);
      pcmChunks = [pcm];
    } else {
      const segments = parseSegments(text);
      console.log(`TTS (segments): voice=${voiceName}, segments=${segments.length}`);
      pcmChunks = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.type === "pause") {
          pcmChunks.push(generateSilence(seg.seconds));
        } else {
          if (i > 0) await sleep(500);
          const pcm = await generateSpeechPcm(ai, seg.content, voiceName, styleInstruction);
          pcmChunks.push(pcm);
        }
      }
    }

    const totalPcm = Buffer.concat(pcmChunks);
    const wav = Buffer.concat([buildWavHeader(totalPcm.length), totalPcm]);
    res.json({ audio: wav.toString("base64") });

  } catch (error: any) {
    console.error("Помилка генерації TTS:", error);
    res.status(500).json({ error: error?.message || "Помилка при озвученні тексту" });
  }
});

async function startServer() {
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
