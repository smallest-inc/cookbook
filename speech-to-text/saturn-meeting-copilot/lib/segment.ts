import type { TranscriptSegment } from "@/types";

const SPEAKER_COLORS = ["#818cf8", "#34d399", "#fb923c", "#f472b6", "#38bdf8", "#a3e635"];

export function speakerColor(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

export function makeSegment(text: string, rawSpeaker?: string): TranscriptSegment {
  const speaker = rawSpeaker ?? "You";
  return {
    id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    speaker,
    speakerColor: speakerColor(speaker),
    text: text.trim(),
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
    isQuestion: text.trimEnd().endsWith("?"),
    isHighlighted: false,
    words: [],
  };
}
