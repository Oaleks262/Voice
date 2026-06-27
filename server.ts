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

function parseWav(buffer: Buffer) {
  let offset = 12;
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let byteRate = 48000;
  let blockAlign = 2;
  let dataSubarray: Buffer | null = null;

  try {
    console.log(`[parseWav] Parsing buffer of size ${buffer.length} bytes`);
    if (buffer.length >= 44) {
      const riffHeader = buffer.toString("ascii", 0, 4);
      const waveHeader = buffer.toString("ascii", 8, 12);
      console.log(`[parseWav] RIFF header: "${riffHeader}", WAVE header: "${waveHeader}"`);
      
      // If it doesn't have a valid RIFF/WAVE header, treat it as raw PCM directly
      if (riffHeader !== "RIFF" || waveHeader !== "WAVE") {
        console.log("[parseWav] No RIFF/WAVE header found. Treating entire buffer as raw PCM 24kHz Mono 16-bit");
        return {
          numChannels: 1,
          sampleRate: 24000,
          bitsPerSample: 16,
          byteRate: 48000,
          blockAlign: 2,
          data: buffer,
        };
      }
    } else {
      console.log("[parseWav] Buffer too short for WAV header. Treating entire buffer as raw PCM 24kHz Mono 16-bit");
      return {
        numChannels: 1,
        sampleRate: 24000,
        bitsPerSample: 16,
        byteRate: 48000,
        blockAlign: 2,
        data: buffer,
      };
    }

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      
      console.log(`[parseWav] Found chunk "${chunkId}" of size ${chunkSize} at offset ${offset}`);

      if (chunkSize < 0 || offset + 8 + chunkSize > buffer.length) {
        console.log(`[parseWav] Chunk size out of bounds or invalid: ${chunkSize}`);
        break;
      }

      if (chunkId === "fmt ") {
        numChannels = buffer.readUInt16LE(offset + 10);
        sampleRate = buffer.readUInt32LE(offset + 12);
        byteRate = buffer.readUInt32LE(offset + 16);
        blockAlign = buffer.readUInt16LE(offset + 20);
        bitsPerSample = buffer.readUInt16LE(offset + 22);
        console.log(`[parseWav] Parsed fmt: channels=${numChannels}, rate=${sampleRate}, bits=${bitsPerSample}`);
      } else if (chunkId === "data") {
        const dataStart = offset + 8;
        dataSubarray = buffer.subarray(dataStart, dataStart + chunkSize);
        console.log(`[parseWav] Parsed data: offset=${dataStart}, size=${chunkSize}, actual length=${dataSubarray.length}`);
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) {
        offset += 1;
      }
    }
  } catch (err) {
    console.error("[parseWav] Error parsing WAV buffer:", err);
  }

  // Apply fallback values if parsing returned invalid/zero properties
  if (!numChannels || numChannels < 1) {
    numChannels = 1;
  }
  if (!sampleRate || sampleRate < 8000) {
    sampleRate = 24000;
  }
  if (!bitsPerSample || bitsPerSample < 8) {
    bitsPerSample = 16;
  }
  if (!byteRate || byteRate < 8000) {
    byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  }
  if (!blockAlign || blockAlign < 1) {
    blockAlign = numChannels * (bitsPerSample / 8);
  }

  // Fallback for PCM data retrieval
  if (!dataSubarray || dataSubarray.length === 0) {
    if (buffer.length > 44) {
      dataSubarray = buffer.subarray(44);
      console.log(`[parseWav] Fallback: sliced buffer at standard offset 44 (length=${dataSubarray.length} bytes)`);
    } else {
      dataSubarray = Buffer.alloc(0);
      console.log(`[parseWav] Fallback: empty PCM buffer`);
    }
  }

  return {
    numChannels,
    sampleRate,
    bitsPerSample,
    byteRate,
    blockAlign,
    data: dataSubarray,
  };
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

    // Parse all generated WAV buffers dynamically to extract exact parameters and PCM data
    const parsedWavs = audioBuffers.map((buf, idx) => {
      const parsed = parseWav(buf);
      if (!parsed.data) {
        throw new Error(`Не вдалося отримати PCM дані з аудіо фрагменту ${idx + 1}`);
      }
      return parsed;
    });

    const firstWavParams = parsedWavs[0];
    const { numChannels, sampleRate, bitsPerSample, byteRate, blockAlign } = firstWavParams;

    const pcmParts: Buffer[] = [];
    let textSegIndex = 0;

    for (const seg of segments) {
      if (seg.type === "text") {
        const parsed = parsedWavs[textSegIndex++];
        if (parsed && parsed.data) {
          pcmParts.push(parsed.data);
        }
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
