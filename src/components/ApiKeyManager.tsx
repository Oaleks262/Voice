import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Key, Eye, EyeOff, Check, Trash2, HelpCircle, ExternalLink, CircleAlert } from "lucide-react";

interface ApiKeyManagerProps {
  customApiKey: string;
  onApiKeyChange: (newKey: string) => void;
  hasSystemApiKey: boolean | null;
}

export default function ApiKeyManager({ customApiKey, onApiKeyChange, hasSystemApiKey }: ApiKeyManagerProps) {
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setInputKey(customApiKey);
    setIsSaved(!!customApiKey);
  }, [customApiKey]);

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      handleDelete();
      return;
    }
    onApiKeyChange(trimmed);
    setIsSaved(true);
    // Auto collapse after a short delay for cleaner UI
    setTimeout(() => {
      setIsExpanded(false);
    }, 800);
  };

  const handleDelete = () => {
    setInputKey("");
    onApiKeyChange("");
    setIsSaved(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4.5 space-y-3.5 transition">
      {/* Header section with status */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 text-slate-800 font-bold text-sm tracking-tight cursor-pointer select-none group focus:outline-none"
        >
          <div className={`p-1.5 rounded-lg border transition-colors ${
            isSaved 
              ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
              : hasSystemApiKey 
                ? "bg-indigo-50 border-indigo-100 text-indigo-600" 
                : "bg-amber-50 border-amber-100 text-amber-600"
          }`}>
            <Key className="h-4 w-4" />
          </div>
          <div className="text-left">
            <span className="group-hover:text-indigo-600 transition">API-ключ Gemini</span>
            <div className="text-[10px] text-slate-400 font-normal">
              {isSaved ? (
                <span className="text-emerald-600 font-medium">● Використовується ваш ключ</span>
              ) : hasSystemApiKey ? (
                <span className="text-indigo-600 font-medium">● Використовується системний ключ</span>
              ) : (
                <span className="text-amber-600 font-medium">● Ключ не знайдено</span>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer select-none"
        >
          {isExpanded ? "Згорнути" : isSaved ? "Змінити" : "Налаштувати"}
        </button>
      </div>

      {/* Main content - expandable */}
      <AnimatePresence initial={false}>
        {(isExpanded || !isSaved && !hasSystemApiKey) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-3"
          >
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                ШІ використовує ваш особистий ключ Gemini для генерації аудіо. Це дозволить обходити обмеження і генерувати великі обсяги тексту.
              </p>

              {/* Input field wrapper */}
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all">
                <input
                  type={showKey ? "text" : "password"}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-transparent text-slate-800 font-mono text-xs outline-none pr-16"
                />
                <div className="absolute right-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                    title={showKey ? "Приховати ключ" : "Показати ключ"}
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  {isSaved && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                      title="Видалити ключ"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions & help info */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                  <span>Отримати безкоштовний ключ</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>

                <button
                  type="button"
                  onClick={handleSave}
                  className="bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Зберегти</span>
                </button>
              </div>

              {!hasSystemApiKey && !isSaved && (
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex gap-2 text-amber-900">
                  <CircleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    <strong>Увага:</strong> На сервері не налаштовано стандартний ключ. Будь ласка, введіть свій власний ключ Gemini, інакше генерація голосу не працюватиме.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
