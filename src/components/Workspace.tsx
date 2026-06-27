import { useState, useTransition, ChangeEvent, useRef } from "react";
import { Trash2, Clock, Type, Sparkles, BookOpen } from "lucide-react";
import { SampleText } from "../types";
import { SAMPLES } from "../data";

interface WorkspaceProps {
  text: string;
  setText: (text: string) => void;
  maxChars?: number;
}

export default function Workspace({ text, setText, maxChars = 5000 }: WorkspaceProps) {
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxChars) {
      setText(val);
    }
  };

  const handleClear = () => {
    setText("");
    setActiveSampleId(null);
  };

  const handleSelectSample = (sample: SampleText) => {
    setText(sample.text);
    setActiveSampleId(sample.id);
  };

  const insertPause = (seconds: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const tag = ` [пауза: ${seconds}] `;
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);

    if (newVal.length <= maxChars) {
      setText(newVal);
      // Move selection to after the inserted tag
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    }
  };

  // Estimate reading duration (approx 130 words per minute or 10 characters per second)
  const estimateReadingTime = () => {
    if (!text.trim()) return "0 сек";
    const wordsCount = text.trim().split(/\s+/).length;
    const totalSeconds = Math.ceil((wordsCount / 130) * 60);
    
    if (totalSeconds < 60) {
      return `${totalSeconds} сек`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} хв ${seconds} сек`;
  };

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">Введіть ваш текст</h2>
        </div>
        
        {text && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition"
            title="Очистити поле"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Очистити</span>
          </button>
        )}
      </div>

      {/* Templates / Samples */}
      <div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Швидкі шаблони для тесту
        </span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleSelectSample(sample)}
              className={`text-left p-2.5 rounded-xl border text-xs transition duration-200 cursor-pointer h-full flex flex-col justify-between ${
                activeSampleId === sample.id
                  ? "bg-indigo-50/70 border-indigo-300 text-indigo-950 font-medium"
                  : "bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-600"
              }`}
            >
              <span className="font-semibold block mb-1 text-slate-800 truncate">
                {sample.title}
              </span>
              <span className="text-[10px] text-slate-400 block bg-white border border-slate-200 px-1.5 py-0.5 rounded-full w-fit">
                {sample.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Pauses helper */}
      <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-indigo-950 font-semibold">
          <Clock className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
          <div>
            <span>⏱️ Інтервали тиші (Паузи)</span>
            <p className="text-[10px] text-slate-500 font-normal">
              Вставляйте позначки пауз для створення реалістичних затримок у мовленні
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {[2, 5, 7, 10].map((s) => (
            <button
              key={s}
              onClick={() => insertPause(s)}
              type="button"
              className="bg-white hover:bg-indigo-50 active:scale-95 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-xs cursor-pointer transition"
            >
              + {s} сек
            </button>
          ))}
          {/* Custom pause button */}
          <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg shadow-xs px-1.5 py-0.5">
            <input
              type="number"
              min="1"
              max="60"
              id="custom-pause-input"
              defaultValue={3}
              placeholder="сек"
              className="w-10 text-[11px] font-bold text-center outline-none bg-transparent text-indigo-950 border-r border-indigo-100 pr-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseInt((e.target as HTMLInputElement).value, 10);
                  if (val > 0 && val <= 60) insertPause(val);
                }
              }}
            />
            <button
              onClick={() => {
                const el = document.getElementById("custom-pause-input") as HTMLInputElement;
                const val = parseInt(el?.value || "3", 10);
                if (val > 0 && val <= 60) insertPause(val);
              }}
              type="button"
              className="text-indigo-600 hover:text-indigo-800 text-[10px] font-extrabold px-1 active:scale-95"
            >
              Додати
            </button>
          </div>
        </div>
      </div>

      {/* Main Textarea Input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder="Введіть або вставте сюди текст, який ви хочете озвучити реалістичним голосом..."
          rows={7}
          className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 rounded-xl p-4 text-slate-800 text-base leading-relaxed placeholder-slate-400 transition outline-none resize-none"
        />
        
        {charCount === 0 && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>Оберіть шаблон вище або почніть писати тут українською чи англійською мовою</span>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Type className="h-3.5 w-3.5 text-slate-400" />
            Слів: <strong className="text-slate-700">{wordCount}</strong>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Час читання: <strong className="text-slate-700">{estimateReadingTime()}</strong>
          </span>
        </div>
        <span className={`${charCount > maxChars * 0.9 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
          {charCount} / {maxChars}
        </span>
      </div>
    </div>
  );
}
