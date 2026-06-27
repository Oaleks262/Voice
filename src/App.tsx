import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, AlertCircle, Headphones, Loader2, Play, CircleAlert, CheckCircle } from "lucide-react";
import { VoiceConfig, VoiceName, EmotionStyle, SpeechSpeed, TtsHistoryItem } from "./types";
import { VOICES, EMOTIONS } from "./data";
import Header from "./components/Header";
import Workspace from "./components/Workspace";
import VoicePanel from "./components/VoicePanel";
import AudioPlayer from "./components/AudioPlayer";
import HistoryList from "./components/HistoryList";

export default function App() {
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>("Zephyr");
  const [selectedStyle, setSelectedStyle] = useState<EmotionStyle>("neutral");
  const [selectedSpeed, setSelectedSpeed] = useState<SpeechSpeed>("normal");
  
  const [audioBase64, setAudioBase64] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [history, setHistory] = useState<TtsHistoryItem[]>([]);

  // 1. Initialise and check API key, and load History
  useEffect(() => {
    // Check key status on server
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
      })
      .catch((err) => {
        console.error("Failed to check server API key config:", err);
        setHasApiKey(false);
      });

    // Load local history
    try {
      const stored = localStorage.getItem("tts_voiceover_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load local TTS history:", e);
    }
  }, []);

  // Update localStorage when history changes
  const saveHistoryToLocalStorage = (newHistory: TtsHistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("tts_voiceover_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save TTS history:", e);
    }
  };

  // 2. Play quick voice preview
  const handlePreviewVoice = async (voice: VoiceConfig) => {
    if (previewingVoiceId) return; // Prevent concurrent previews
    setPreviewingVoiceId(voice.id);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: voice.previewText,
          voice: voice.id,
          style: "neutral",
          speed: "normal"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не вдалося озвучити прев'ю голосу");
      }

      if (data.audio) {
        // Decode base64 to play back immediately
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        audio.play().catch(err => console.error("Preview playback failed:", err));
        
        audio.onended = () => {
          setPreviewingVoiceId(null);
          URL.revokeObjectURL(url);
        };
      } else {
        throw new Error("Аудіодані відсутні");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Не вдалося озвучити прев'ю: ${err.message}`);
      setPreviewingVoiceId(null);
    }
  };

  // 3. Generate Full Voiceover Text-to-Speech
  const handleGenerateTts = async () => {
    if (!text.trim()) {
      setErrorMsg("Будь ласка, введіть або оберіть текст для озвучення.");
      return;
    }
    
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          style: selectedStyle,
          speed: selectedSpeed
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Помилка при генерації аудіо.");
      }

      if (data.audio) {
        setAudioBase64(data.audio);
        setSuccessMsg("Текст успішно озвучено! Можна прослухати у плеєрі.");
      } else {
        throw new Error("Аудіодані відсутні у відповіді сервера.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Сталася помилка при генерації голосу. Перевірте підключення до сервера.");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Save current active result to history library
  const handleSaveToHistory = () => {
    if (!audioBase64) return;

    // Check if already saved (avoid duplicates)
    const isAlreadySaved = history.some((item) => item.audioBase64 === audioBase64);
    if (isAlreadySaved) {
      setSuccessMsg("Це озвучення вже збережено у вашій бібліотеці.");
      return;
    }

    const newItem: TtsHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: text.length > 100 ? text.substring(0, 100) + "..." : text,
      voice: selectedVoice,
      style: selectedStyle,
      speed: selectedSpeed,
      audioBase64,
      createdAt: Date.now()
    };

    const updated = [newItem, ...history];
    saveHistoryToLocalStorage(updated);
    setSuccessMsg("Озвучення збережено у локальну бібліотеку!");
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    saveHistoryToLocalStorage(updated);
  };

  const handleClearHistory = () => {
    if (window.confirm("Ви дійсно хочете очистити всю бібліотеку озвучень?")) {
      saveHistoryToLocalStorage([]);
    }
  };

  // Load a previously voiced item back into player
  const handleLoadIntoPlayer = (item: TtsHistoryItem) => {
    setText(item.text);
    setSelectedVoice(item.voice);
    setSelectedStyle(item.style);
    setSelectedSpeed(item.speed);
    setAudioBase64(item.audioBase64);
    setSuccessMsg("Озвучення успішно завантажено з бібліотеки в плеєр!");
  };

  const getStyleLabel = () => {
    return EMOTIONS.find((e) => e.id === selectedStyle)?.label || "Нейтральний";
  };

  const getVoiceNameDisplay = () => {
    return VOICES.find((v) => v.id === selectedVoice)?.name || selectedVoice;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <Header hasApiKey={hasApiKey} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* API Key Missing Alert */}
        {hasApiKey === false && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800 shadow-sm animate-fade-in">
            <CircleAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <strong className="font-semibold block text-amber-900 mb-0.5">Відсутній API-ключ Gemini</strong>
              <span>
                Ваша інсталяція не виявила ключ <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">GEMINI_API_KEY</code>. 
                Будь ласка, відкрийте меню <strong>Settings &gt; Secrets</strong> у верхній панелі інструментів AI Studio та додайте свій 
                ключ, щоб розпочати озвучення.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (8 cols): Workspace & Audio Player */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Input Workspace */}
            <Workspace text={text} setText={setText} />

            {/* Error Message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-2.5 text-sm"
                >
                  <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success Message */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm"
                >
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions Bar */}
            <div className="flex justify-end items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateTts}
                disabled={isLoading || !text.trim()}
                className={`w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm tracking-wide shadow-lg transition duration-200 flex items-center justify-center gap-2.5 cursor-pointer select-none border border-indigo-700 ${
                  isLoading
                    ? "bg-indigo-600/80 text-indigo-100"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 hover:shadow-indigo-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                    <span>Голос синтезується...</span>
                  </>
                ) : (
                  <>
                    <Headphones className="h-5 w-5" />
                    <span>Синтезувати реальний голос</span>
                  </>
                )}
              </button>
            </div>

            {/* Audio Player (conditionally rendered) */}
            <AnimatePresence mode="wait">
              {audioBase64 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <AudioPlayer
                    audioBase64={audioBase64}
                    voiceName={getVoiceNameDisplay()}
                    styleLabel={getStyleLabel()}
                    onSaveToHistory={handleSaveToHistory}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* History Logs */}
            <HistoryList
              history={history}
              onDelete={handleDeleteHistoryItem}
              onClearAll={handleClearHistory}
              onLoadIntoPlayer={handleLoadIntoPlayer}
            />

          </div>

          {/* Right Column (4 cols): Voice customization panel */}
          <div className="lg:col-span-4">
            <VoicePanel
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              selectedStyle={selectedStyle}
              setSelectedStyle={setSelectedStyle}
              selectedSpeed={selectedSpeed}
              setSelectedSpeed={setSelectedSpeed}
              onPreviewVoice={handlePreviewVoice}
              previewingVoiceId={previewingVoiceId}
            />
          </div>

        </div>

      </main>

      {/* Clean elegant Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Майстерня Озвучення • Працює на базі Google Gemini 3.1 TTS</p>
          <p className="mt-1 text-[10px] text-slate-300">
            Всі права захищені. Звукові файли генеруються на локальному сервері без передачі стороннім особам.
          </p>
        </div>
      </footer>
    </div>
  );
}
