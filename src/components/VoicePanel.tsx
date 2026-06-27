import { useState } from "react";
import { User, Volume2, Play, Square, Check, Flame, MessageSquareHeart } from "lucide-react";
import { VoiceConfig, VoiceName, EmotionStyle, SpeechSpeed } from "../types";
import { VOICES, EMOTIONS, SPEEDS } from "../data";

interface VoicePanelProps {
  selectedVoice: VoiceName;
  setSelectedVoice: (voice: VoiceName) => void;
  selectedStyle: EmotionStyle;
  setSelectedStyle: (style: EmotionStyle) => void;
  selectedSpeed: SpeechSpeed;
  setSelectedSpeed: (speed: SpeechSpeed) => void;
  onPreviewVoice: (voice: VoiceConfig) => Promise<void>;
  previewingVoiceId: string | null;
}

export default function VoicePanel({
  selectedVoice,
  setSelectedVoice,
  selectedStyle,
  setSelectedStyle,
  selectedSpeed,
  setSelectedSpeed,
  onPreviewVoice,
  previewingVoiceId
}: VoicePanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-6">
      
      {/* 1. Voice Models Selection */}
      <div>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
          <User className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">Оберіть ШІ-голос</h2>
        </div>
        
        <div className="space-y-3">
          {VOICES.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            const isPreviewing = previewingVoiceId === voice.id;
            
            return (
              <div
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                className={`relative p-4 rounded-xl border text-left cursor-pointer transition duration-200 group flex items-start justify-between gap-3 ${
                  isSelected
                    ? "bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-100"
                    : "bg-slate-50 hover:bg-slate-100/70 border-slate-200"
                }`}
              >
                {/* Selection Check Ring */}
                {isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white rounded-full p-0.5 shadow-md">
                    <Check className="h-3 w-3" />
                  </span>
                )}

                {/* Left contents */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">
                      {voice.name}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        voice.gender === "female"
                          ? "bg-pink-50 text-pink-700 border border-pink-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {voice.gender === "female" ? "Жіночий" : "Чоловічий"}
                    </span>
                    
                    {/* Tags */}
                    {voice.tags.slice(0, 1).map((tag, i) => (
                      <span key={i} className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed pr-6 line-clamp-2">
                    {voice.description}
                  </p>
                </div>

                {/* Quick Voice Preview Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // Avoid selecting the card
                    onPreviewVoice(voice);
                  }}
                  disabled={previewingVoiceId !== null && !isPreviewing}
                  className={`p-2.5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                    isPreviewing
                      ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-indigo-600"
                  } disabled:opacity-50`}
                  title="Послухати приклад голосу"
                >
                  {isPreviewing ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Style/Emotion Customizer */}
      <div>
        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
          <MessageSquareHeart className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">Емоція та Настрій</h2>
        </div>
        
        <p className="text-xs text-slate-400 mb-3">
          Змініть емоційне забарвлення мовлення диктора
        </p>

        <div className="grid grid-cols-2 gap-2">
          {EMOTIONS.map((emotion) => {
            const isSelected = selectedStyle === emotion.id;
            return (
              <button
                key={emotion.id}
                type="button"
                onClick={() => setSelectedStyle(emotion.id)}
                className={`text-left p-3 rounded-xl border transition flex flex-col justify-between gap-1 group cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-100 text-indigo-950 font-medium"
                    : "bg-slate-50 hover:bg-slate-100/50 border-slate-200 text-slate-600"
                }`}
                title={emotion.description}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{emotion.emoji}</span>
                  <span className="text-xs font-semibold">{emotion.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 line-clamp-1 group-hover:text-slate-500">
                  {emotion.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Speech Speed */}
      <div>
        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
          <Flame className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">Швидкість мовлення</h2>
        </div>

        <div className="bg-slate-50 p-1 rounded-xl border border-slate-200 flex gap-1">
          {SPEEDS.map((speed) => {
            const isSelected = selectedSpeed === speed.id;
            return (
              <button
                key={speed.id}
                type="button"
                onClick={() => setSelectedSpeed(speed.id)}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title={speed.description}
              >
                {speed.label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
