import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy initialisation of Gemini client to prevent startup crash if API key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please add your own API Key in the settings panel at the top, or contact the site administrator.");
  }
  
  if (customApiKey) {
    return new GoogleGenAI({
      apiKey: customApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build-custom",
        },
      },
    });
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
    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Будь ласка, введіть текст для озвучення." });
    }
    
    if (text.length > 5000) {
      return res.status(400).json({ error: "Текст занадто довгий (максимум 5000 символів)." });
    }

    const ai = getGeminiClient(customApiKey);

    // Map emotion styles
    let styleInstruction = "Say";
    if (style === "cheerful") styleInstruction += " cheerfully";
    else if (style === "sad") styleInstruction += " sadly";
    else if (style === "excited") styleInstruction += " excitedly";
    else if (style === "whispering") styleInstruction += " in a quiet whisper";
    else if (style === "dramatic") styleInstruction += " dramatically";
    else if (style === "serious") styleInstruction += " seriously and professionally";
    else if (style === "calm") styleInstruction += " calmly and softly";
    else if (style === "soothing") styleInstruction += " in a very soothing, warm, slow and deeply relaxed voice like a mindfulness meditation guide";
    else styleInstruction += " clearly";

    // Map speed configurations
    if (speed === "slow") styleInstruction += " and slowly";
    else if (speed === "fast") styleInstruction += " and fast";

    const voiceName = voice || "Zephyr"; // Puck, Charon, Kore, Fenrir, Zephyr

    // Split text into text segments and pause segments
    // Matches patterns like [pause: 5], [пауза: 5]
    const regex = /\[(?:pause|пауза):\s*(\d+)\]/gi;
    const segments: { type: "text" | "pause"; content: string; duration?: number }[] = [];
    
    let match;
    let lastIndex = 0;
    
    while ((match = regex.exec(text)) !== null) {
      const textBefore = text.substring(lastIndex, match.index).trim();
      if (textBefore) {
        segments.push({ type: "text", content: textBefore });
      }
      segments.push({ type: "pause", content: match[0], duration: parseInt(match[1], 10) });
      lastIndex = regex.lastIndex;
    }
    
    const textAfter = text.substring(lastIndex).trim();
    if (textAfter) {
      segments.push({ type: "text", content: textAfter });
    }

    if (segments.length === 0) {
      return res.status(400).json({ error: "Введений текст порожній." });
    }

    // Process all text segments in parallel using Gemini TTS
    const textSegments = segments.filter((s) => s.type === "text");

    if (textSegments.length === 0) {
      // If only pauses were sent, just return a single silent track
      const totalDuration = segments.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      const defaultSampleRate = 24000;
      const defaultByteRate = 48000;
      const silenceBytes = defaultByteRate * totalDuration;
      const silentPcm = Buffer.alloc(silenceBytes, 0);

      const header = Buffer.alloc(44);
      header.write("RIFF", 0);
      header.writeUInt32LE(36 + silentPcm.length, 4);
      header.write("WAVE", 8);
      header.write("fmt ", 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22); // mono
      header.writeUInt32LE(defaultSampleRate, 24);
      header.writeUInt32LE(defaultByteRate, 28);
      header.writeUInt16LE(2, 32); // 16-bit mono
      header.writeUInt16LE(16, 34);
      header.write("data", 36);
      header.writeUInt32LE(silentPcm.length, 40);

      const finalWav = Buffer.concat([header, silentPcm]);
      return res.json({ audio: finalWav.toString("base64") });
    }

    console.log(`Generating speech segments via gemini-3.1-flash-tts-preview: voice=${voiceName}, segmentsCount=${textSegments.length}`);

    // Helper function with exponential backoff for rate limits (429)
    const generateWithRetry = async (seg: { content: string }, attempt = 1): Promise<Buffer> => {
      const maxAttempts = 6;
      const promptText = `${styleInstruction}: ${seg.content}`;
      try {
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
          throw new Error(`ШІ не повернув звукові дані для фрагменту: "${seg.content.substring(0, 30)}..."`);
        }
        return Buffer.from(base64Audio, "base64");
      } catch (error: any) {
        const errorStr = typeof error === "object" ? JSON.stringify(error) : String(error);
        const isQuota = 
          errorStr.includes("RESOURCE_EXHAUSTED") || 
          errorStr.includes("Quota exceeded") || 
          errorStr.includes("429") || 
          error?.status === 429 ||
          error?.status === "RESOURCE_EXHAUSTED";

        if (isQuota && attempt < maxAttempts) {
          // In Tier 1 or free tier, we have a 10 RPM (requests per minute) limit.
          // Wait longer on successive retries: 6s, 12s, 18s, 24s...
          const delayMs = attempt * 6000;
          console.warn(`[Попередження] Досягнуто ліміту запитів (429). Спроба ${attempt}/${maxAttempts}. Очікуємо ${delayMs / 1000} сек...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return generateWithRetry(seg, attempt + 1);
        }
        throw error;
      }
    };

    // Execute sequentially with a small delay between requests to avoid slamming the API
    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < textSegments.length; i++) {
      const seg = textSegments[i];
      console.log(`Processing segment ${i + 1}/${textSegments.length}: "${seg.content.substring(0, 30)}..."`);
      
      if (i > 0) {
        // Add a small delay between requests to remain under limits
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      
      const buffer = await generateWithRetry(seg);
      audioBuffers.push(buffer);
    }

    // If there is only one text segment and NO pauses, return it directly
    const pauseSegments = segments.filter((s) => s.type === "pause");
    if (pauseSegments.length === 0 && audioBuffers.length === 1) {
      return res.json({ audio: audioBuffers[0].toString("base64") });
    }

    const firstWav = audioBuffers[0];
    if (!firstWav || firstWav.length < 44) {
      throw new Error("Некоректний формат аудіо від ШІ");
    }

    // Read WAV parameters from header dynamically
    const numChannels = firstWav.readUInt16LE(22);
    const sampleRate = firstWav.readUInt32LE(24);
    const bitsPerSample = firstWav.readUInt16LE(34);
    const byteRate = firstWav.readUInt32LE(28);
    const blockAlign = firstWav.readUInt16LE(32);

    const pcmParts: Buffer[] = [];
    let textSegIndex = 0;

    for (const seg of segments) {
      if (seg.type === "text") {
        const wavBuffer = audioBuffers[textSegIndex++];
        const pcmData = wavBuffer.subarray(44);
        pcmParts.push(pcmData);
      } else if (seg.type === "pause") {
        const durationSeconds = seg.duration || 1;
        const silenceBytesCount = byteRate * durationSeconds;
        pcmParts.push(Buffer.alloc(silenceBytesCount, 0));
      }
    }

    // Combine all PCM parts
    const combinedPcm = Buffer.concat(pcmParts);

    // Construct valid WAV header
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + combinedPcm.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(combinedPcm.length, 40);

    const finalWav = Buffer.concat([header, combinedPcm]);
    res.json({ audio: finalWav.toString("base64") });
  } catch (error: any) {
    console.error("Помилка генерації TTS:", error);
    
    let errMsg = error?.message || "Помилка при озвученні тексту";
    
    // Check for quota or rate limit errors
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const isQuotaError = 
      errMsg.includes("RESOURCE_EXHAUSTED") || 
      errMsg.includes("Quota exceeded") || 
      errMsg.includes("429") ||
      errorStr.includes("RESOURCE_EXHAUSTED") ||
      errorStr.includes("Quota exceeded") ||
      error?.status === 429 ||
      error?.status === "RESOURCE_EXHAUSTED";

    if (isQuotaError) {
      errMsg = "Перевищено ліміт запитів до Gemini API (429 Resource Exhausted). Безкоштовний тариф дозволяє лише 10 запитів на хвилину. Оскільки ваші позначки пауз розбивають текст на окремі фрагменти, кожен такий фрагмент надсилається як окремий запит. Будь ласка, зачекайте 30 секунд або підключіть платний тариф (Pay-as-you-go) для вашого API-ключа.";
    }
    
    res.status(500).json({ error: errMsg });
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
