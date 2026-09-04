import { create } from "zustand";
import {
  MeetingState,
  MeetingStatus,
  SttStatus,
  TranscriptSegment,
  Insight,
  ActionItem,
  TopicEvent,
  MeetingSummary,
} from "@/types";

interface MeetingActions {
  setStatus: (status: MeetingStatus) => void;
  setTitle: (title: string) => void;
  startMeeting: () => void;
  pauseMeeting: () => void;
  endMeeting: () => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  updateTranscriptSegment: (id: string, updates: Partial<TranscriptSegment>) => void;
  addInsight: (insight: Insight) => void;
  updateInsight: (id: string, updates: Partial<Insight>) => void;
  setActiveInsight: (id: string | null) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionItem: (id: string, updates: Partial<ActionItem>) => void;
  addTopic: (topic: TopicEvent) => void;
  updateTopic: (id: string, updates: Partial<TopicEvent>) => void;
  setSummary: (summary: MeetingSummary) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceId: (id: string) => void;
  setVoiceSpeed: (speed: number) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setSttStatus: (status: SttStatus, error?: string | null) => void;
  setSttLanguage: (language: string) => void;
  setResearchResultCount: (count: number) => void;
  incrementResearch: () => void;
  decrementResearch: () => void;
  updateCreditBalance: (amount: number) => void;
  reset: () => void;
}

const initialState: MeetingState = {
  status: "idle",
  title: "Untitled Meeting",
  startTime: null,
  duration: 0,
  transcript: [],
  insights: [],
  actionItems: [],
  topics: [],
  summary: null,
  isVoiceEnabled: false,
  voiceId: "emily",
  voiceSpeed: 1.0,
  isSpeaking: false,
  activeInsightId: null,
  activeResearchCount: 0,
  creditBalance: 250,
  sttStatus: "idle",
  sttError: null,
  sttLanguage: "en",
  researchResultCount: 5,
};

export const useMeetingStore = create<MeetingState & MeetingActions>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setTitle: (title) => set({ title }),

  startMeeting: () =>
    set({
      status: "listening",
      startTime: new Date(),
      transcript: [],
      insights: [],
      actionItems: [],
      summary: null,
      sttStatus: "idle",
      sttError: null,
    }),

  pauseMeeting: () => set({ status: "paused" }),

  endMeeting: () => set({ status: "ended" }),

  addTranscriptSegment: (segment) =>
    set((state) => ({ transcript: [...state.transcript, segment] })),

  updateTranscriptSegment: (id, updates) =>
    set((state) => ({
      transcript: state.transcript.map((seg) =>
        seg.id === id ? { ...seg, ...updates } : seg
      ),
    })),

  addInsight: (insight) =>
    set((state) => ({ insights: [insight, ...state.insights] })),

  updateInsight: (id, updates) =>
    set((state) => ({
      insights: state.insights.map((ins) =>
        ins.id === id ? { ...ins, ...updates } : ins
      ),
    })),

  setActiveInsight: (id) => set({ activeInsightId: id }),

  addActionItem: (item) =>
    set((state) => ({ actionItems: [...state.actionItems, item] })),

  updateActionItem: (id, updates) =>
    set((state) => ({
      actionItems: state.actionItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  addTopic: (topic) =>
    set((state) => ({ topics: [...state.topics, topic] })),

  updateTopic: (id, updates) =>
    set((state) => ({
      topics: state.topics.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setSummary: (summary) => set({ summary }),

  setVoiceEnabled: (enabled) => set({ isVoiceEnabled: enabled }),

  setVoiceId: (id) => set({ voiceId: id }),

  setVoiceSpeed: (speed) => set({ voiceSpeed: speed }),

  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),

  setSttStatus: (status, error = null) => set({ sttStatus: status, sttError: error ?? null }),

  setSttLanguage: (language) => set({ sttLanguage: language }),

  setResearchResultCount: (count) => set({ researchResultCount: count }),

  incrementResearch: () =>
    set((state) => ({ activeResearchCount: state.activeResearchCount + 1 })),

  decrementResearch: () =>
    set((state) => ({
      activeResearchCount: Math.max(0, state.activeResearchCount - 1),
    })),

  updateCreditBalance: (amount) =>
    set((state) => ({ creditBalance: state.creditBalance + amount })),

  reset: () => set(initialState),
}));
