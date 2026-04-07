export interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerColor: string;
  text: string;
  timestamp: string;
  isQuestion: boolean;
  isHighlighted: boolean;
  words: Word[];
}

export interface Word {
  text: string;
  confidence: number;
  startTime: number;
}

export interface Insight {
  id: string;
  topic: string;
  query: string;
  bullets: string[];
  sources: Source[];
  confidence: number;
  timestamp: string;
  status: "researching" | "ready" | "error";
  triggerSegmentId?: string;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  detectedAt: string;
  status: "open" | "done";
}

export interface TopicEvent {
  id: string;
  topic: string;
  startTime: string;
  endTime?: string;
  color: string;
}

export interface MeetingSummary {
  title: string;
  duration: string;
  decisions: string[];
  actionItems: ActionItem[];
  summary: string;
  topics: string[];
}

export type MeetingStatus = "idle" | "listening" | "paused" | "ended";
export type SttStatus = "idle" | "listening" | "transcribing" | "error";

export interface MeetingState {
  status: MeetingStatus;
  title: string;
  startTime: Date | null;
  duration: number;
  transcript: TranscriptSegment[];
  insights: Insight[];
  actionItems: ActionItem[];
  topics: TopicEvent[];
  summary: MeetingSummary | null;
  isVoiceEnabled: boolean;
  voiceId: string;
  voiceSpeed: number;
  isSpeaking: boolean;
  activeInsightId: string | null;
  activeResearchCount: number;
  creditBalance: number;
  sttStatus: SttStatus;
  sttError: string | null;
  sttLanguage: string;
  researchResultCount: number;
}
