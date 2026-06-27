import { useState } from "react";
import { History, Trash2, Calendar, Play, Download, Search, Sparkles, ArrowUpRight } from "lucide-react";
import { TtsHistoryItem } from "../types";
import { EMOTIONS, VOICES } from "../data";
import { base64ToBlobUrl } from "../utils/audio";

interface HistoryListProps {
  history: TtsHistoryItem[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onLoadIntoPlayer: (item: TtsHistoryItem) => void;
}

export default function HistoryList({
  history,
  onDelete,
  onClearAll,
  onLoadIntoPlayer
}: HistoryListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredHistory = history.filter((item) =>
    item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.voice.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getEmotionEmoji = (styleId: string) => {
    return EMOTIONS.find((e) => e.id === styleId)?.emoji || "😐";
  };

  const getEmotionLabel = (styleId: string) => {
    return EMOTIONS.find((e) => e.id === styleId)?.label || "Нейтральний";
  };

  const handleDownload = (item: TtsHistoryItem) => {
    const url = base64ToBlobUrl(item.audioBase64, "audio/wav");
    if (!url) return;
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `voiceover-${item.voice.toLowerCase()}-${item.id}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">Ваша бібліотека озвучень</h2>
          <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-bold">
            {history.length}
          </span>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition"
          >
            Очистити все
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 px-4 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Sparkles className="h-8 w-8 text-indigo-200 mb-2" />
          <p className="text-sm font-semibold text-slate-600 mb-1">Тут поки порожньо</p>
          <p className="text-xs text-slate-400 max-w-[280px]">
            Озвучте свій перший текст, і він з'явиться у цьому списку для швидкого доступу та повторного скачування.
          </p>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук за текстом або голосом..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 outline-none transition"
            />
          </div>

          {/* History list */}
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {filteredHistory.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">Нічого не знайдено за вашим запитом.</p>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50/80 transition duration-150 flex flex-col gap-2 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Tags row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-lg">
                        {item.voice}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                        <span>{getEmotionEmoji(item.style)}</span>
                        <span>{getEmotionLabel(item.style)}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.createdAt)}
                      </span>
                    </div>

                    {/* Quick Delete */}
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition md:opacity-0 group-hover:opacity-100"
                      title="Видалити"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Text snippet */}
                  <p className="text-xs text-slate-700 leading-relaxed font-normal line-clamp-2">
                    "{item.text}"
                  </p>

                  {/* Action tray */}
                  <div className="flex items-center gap-2 mt-1 border-t border-slate-100/60 pt-2 flex-wrap">
                    <button
                      onClick={() => onLoadIntoPlayer(item)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50/50 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Відтворити в плеєрі</span>
                    </button>

                    <button
                      onClick={() => handleDownload(item)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 bg-slate-100/50 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Download className="h-3 w-3" />
                      <span>Завантажити WAV</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
