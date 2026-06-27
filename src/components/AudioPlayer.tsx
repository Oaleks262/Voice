import { useState, useEffect, useRef, MouseEvent, ChangeEvent } from "react";
import { Play, Pause, Download, Volume2, VolumeX, RotateCcw, AudioLines, Gauge } from "lucide-react";

interface AudioPlayerProps {
  audioBase64: string;
  title?: string;
  voiceName: string;
  styleLabel: string;
  onSaveToHistory?: () => void;
}

export default function AudioPlayer({
  audioBase64,
  title = "Озвучений текст",
  voiceName,
  styleLabel,
  onSaveToHistory
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioUrl, setAudioUrl] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  // Decode base64 to Blob URL
  useEffect(() => {
    if (!audioBase64) return;
    
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBase64]);

  // Audio elements event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  // Control volume and playback speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate, audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const restartAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const handleProgressBarClick = (e: MouseEvent<HTMLDivElement>) => {
    const progressContainer = progressRef.current;
    const audio = audioRef.current;
    if (!progressContainer || !audio || duration === 0) return;

    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    
    audio.currentTime = percentage * duration;
    setCurrentTime(audio.currentTime);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (newVol > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleDownload = () => {
    if (!audioBase64) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `voiceover-${voiceName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Render randomized vertical sound waves which move when `isPlaying` is true
  const renderWaveform = () => {
    const barCount = 36;
    const bars = [];
    for (let i = 0; i < barCount; i++) {
      // Create interesting height patterns
      const baseHeight = 15 + Math.sin(i * 0.4) * 12 + Math.cos(i * 0.1) * 8;
      const animationDelay = `${i * 0.04}s`;
      
      bars.push(
        <div
          key={i}
          style={{
            height: isPlaying ? undefined : `${Math.max(4, baseHeight / 2.5)}px`,
            animationDelay: isPlaying ? animationDelay : undefined,
          }}
          className={`w-[3px] rounded-full bg-gradient-to-t from-indigo-500 to-indigo-400 transition-all duration-300 ${
            isPlaying ? "animate-wave h-10" : ""
          }`}
        />
      );
    }
    return <div className="flex items-end justify-center gap-[3px] h-14 w-full px-2">{bars}</div>;
  };

  return (
    <div className="bg-indigo-950 text-white rounded-2xl border border-indigo-900 shadow-xl p-5 md:p-6 relative overflow-hidden">
      {/* Decorative ambient background blur */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hidden native audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      <div className="relative flex flex-col gap-5">
        {/* Header summary of current voice */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-800 text-indigo-200 p-2 rounded-lg">
              <AudioLines className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300">
                Готово до прослуховування
              </span>
              <h3 className="text-sm font-bold text-slate-100 line-clamp-1">
                Голос: {voiceName} • {styleLabel}
              </h3>
            </div>
          </div>

          <div className="flex gap-2">
            {onSaveToHistory && (
              <button
                onClick={onSaveToHistory}
                className="text-xs font-semibold bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-800 px-3 py-1.5 rounded-lg transition"
              >
                Зберегти в бібліотеку
              </button>
            )}
            <button
              onClick={handleDownload}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
              title="Завантажити звуковий файл WAV"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Завантажити WAV</span>
            </button>
          </div>
        </div>

        {/* Animated Visualizer */}
        <div className="bg-indigo-900/40 rounded-xl p-3 border border-indigo-800/40 flex items-center justify-center min-h-[72px]">
          {renderWaveform()}
        </div>

        {/* Custom Seek Progress Bar */}
        <div className="space-y-1">
          <div
            ref={progressRef}
            onClick={handleProgressBarClick}
            className="h-2 w-full bg-indigo-900 hover:bg-indigo-855 rounded-full cursor-pointer relative overflow-hidden group transition-all"
          >
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-300 rounded-full relative transition-all duration-75"
            />
          </div>
          <div className="flex justify-between text-[11px] text-indigo-200 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          {/* Main playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={restartAudio}
              className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-900 rounded-lg transition"
              title="Скинути спочатку"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlay}
              className="h-12 w-12 rounded-full bg-white hover:bg-indigo-50 text-indigo-950 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-indigo-950 text-indigo-950" />
              ) : (
                <Play className="h-5 w-5 fill-indigo-950 text-indigo-950 ml-0.5" />
              )}
            </button>
          </div>

          {/* Speed settings / Playback rate */}
          <div className="flex items-center gap-2">
            <div className="bg-indigo-900/50 rounded-lg p-1 border border-indigo-800/50 flex gap-0.5 items-center">
              <Gauge className="h-3.5 w-3.5 text-indigo-300 ml-1.5 mr-1" />
              {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                    playbackRate === rate
                      ? "bg-white text-indigo-950"
                      : "text-indigo-200 hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[120px]">
            <button
              onClick={toggleMute}
              className="text-indigo-200 hover:text-white p-1"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full sm:w-24 h-1 bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
