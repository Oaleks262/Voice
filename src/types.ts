export type VoiceName = "Zephyr" | "Kore" | "Puck" | "Charon" | "Fenrir";

export type EmotionStyle =
  | "neutral"
  | "cheerful"
  | "sad"
  | "excited"
  | "whispering"
  | "dramatic"
  | "serious"
  | "calm"
  | "soothing";

export type SpeechSpeed = "slow" | "normal" | "fast";

export interface VoiceConfig {
  id: VoiceName;
  name: string;
  gender: "male" | "female";
  description: string;
  previewText: string;
  tags: string[];
}

export interface EmotionStyleConfig {
  id: EmotionStyle;
  label: string;
  emoji: string;
  description: string;
}

export interface SpeechSpeedConfig {
  id: SpeechSpeed;
  label: string;
  description: string;
}

export interface TtsHistoryItem {
  id: string;
  text: string;
  voice: VoiceName;
  style: EmotionStyle;
  speed: SpeechSpeed;
  audioBase64: string;
  createdAt: number;
}

export interface SampleText {
  id: string;
  title: string;
  category: string;
  text: string;
}
