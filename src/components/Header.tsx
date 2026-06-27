import { Sparkles, AudioLines, Settings, Key, HelpCircle } from "lucide-react";

interface HeaderProps {
  hasApiKey: boolean | null;
}

export default function Header({ hasApiKey }: HeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center">
            <AudioLines className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Озвучення Тексту
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-widest">
                Gemini ШІ
              </span>
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              Професійний синтез мовлення з реалістичними інтонаціями
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Key Status indicator */}
          <div className="flex items-center gap-2">
            {hasApiKey === null ? (
              <div className="h-2 w-2 rounded-full bg-slate-300 animate-ping" />
            ) : hasApiKey ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                <span className="hidden xs:inline">Ключ Активовано</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                <span className="hidden xs:inline">Потрібен ключ</span>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Quick info tip */}
          <div className="text-xs text-slate-400 hidden lg:flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span>Підтримка української вимови</span>
          </div>
        </div>
      </div>
    </header>
  );
}
