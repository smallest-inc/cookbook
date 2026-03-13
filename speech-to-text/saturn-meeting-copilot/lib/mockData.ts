import { TranscriptSegment, Insight, ActionItem, TopicEvent } from "@/types";

export const SPEAKER_COLORS: Record<string, string> = {
  You: "#818cf8",
  Sarah: "#34d399",
  Marcus: "#fb923c",
  Priya: "#f472b6",
  Alex: "#38bdf8",
};

export function getSpeakerColor(speaker: string): string {
  return SPEAKER_COLORS[speaker] || "#a78bfa";
}

const now = new Date();
const fmt = (offset: number) => {
  const d = new Date(now.getTime() - offset * 1000);
  return d.toTimeString().slice(0, 8);
};

export const MOCK_TRANSCRIPT: TranscriptSegment[] = [
  {
    id: "t1",
    speaker: "Sarah",
    speakerColor: SPEAKER_COLORS.Sarah,
    text: "Alright everyone, let's kick off. Today we're reviewing Q2 strategy and some new AI tooling.",
    timestamp: fmt(180),
    isQuestion: false,
    isHighlighted: false,
    words: [],
  },
  {
    id: "t2",
    speaker: "Marcus",
    speakerColor: SPEAKER_COLORS.Marcus,
    text: "Before we dive in — what's the current market size for voice AI? I want to make sure our positioning makes sense.",
    timestamp: fmt(150),
    isQuestion: true,
    isHighlighted: true,
    words: [],
  },
  {
    id: "t3",
    speaker: "You",
    speakerColor: SPEAKER_COLORS.You,
    text: "Great question. I've seen some numbers but they vary a lot. Saturn is pulling that up now.",
    timestamp: fmt(120),
    isQuestion: false,
    isHighlighted: false,
    words: [],
  },
  {
    id: "t4",
    speaker: "Priya",
    speakerColor: SPEAKER_COLORS.Priya,
    text: "Also, who are the main competitors in conversational AI right now? We need a clearer picture.",
    timestamp: fmt(90),
    isQuestion: true,
    isHighlighted: true,
    words: [],
  },
  {
    id: "t5",
    speaker: "Sarah",
    speakerColor: SPEAKER_COLORS.Sarah,
    text: "Let's follow up on the competitive analysis with the product team by end of week.",
    timestamp: fmt(60),
    isQuestion: false,
    isHighlighted: false,
    words: [],
  },
];

export const MOCK_INSIGHTS: Insight[] = [
  {
    id: "i1",
    topic: "Voice AI Market Size",
    query: "voice AI market size 2024 2030",
    bullets: [
      "Global voice AI market estimated at $4.8B in 2024, projected to reach $30.4B by 2030",
      "CAGR of ~36% driven by conversational AI, smart assistants, and enterprise adoption",
      "Major players: ElevenLabs, OpenAI Whisper, Speechmatics, Deepgram, smallest.ai",
      "Enterprise segment is fastest growing — meeting AI tools gaining significant traction",
    ],
    sources: [
      {
        title: "Voice AI Market Report 2024 — MarketsandMarkets",
        url: "https://www.marketsandmarkets.com/voice-ai",
        snippet: "The voice AI market is expected to grow from $4.8B to $30.4B...",
      },
      {
        title: "State of Conversational AI 2024 — a16z",
        url: "https://a16z.com/conversational-ai-2024",
        snippet: "Enterprise voice tools are seeing 3x YoY growth...",
      },
      {
        title: "Voice Technology Landscape — CB Insights",
        url: "https://www.cbinsights.com/voice-tech",
        snippet: "Key drivers include remote work, AI assistant adoption...",
      },
    ],
    confidence: 0.91,
    timestamp: fmt(130),
    status: "ready",
    triggerSegmentId: "t2",
  },
  {
    id: "i2",
    topic: "Conversational AI Competitors",
    query: "conversational AI competitors landscape 2024",
    bullets: [
      "OpenAI dominates with GPT-4 + real-time voice API, now embedded in enterprise tools",
      "Anthropic's Claude gaining enterprise ground with safety-first positioning",
      "Emerging: Otter.ai, Fireflies.ai focus on meeting transcription niche",
      "Google's Gemini and Microsoft Copilot embedded in productivity suites — huge distribution",
      "Differentiation opportunity: real-time research layer + voice response is underserved",
    ],
    sources: [
      {
        title: "Conversational AI Landscape 2024 — Sequoia",
        url: "https://sequoiacap.com/ai-landscape",
        snippet: "The meeting AI space remains fragmented...",
      },
      {
        title: "G2 Best AI Meeting Assistants 2024",
        url: "https://www.g2.com/ai-meeting-tools",
        snippet: "Top tools ranked by user reviews...",
      },
    ],
    confidence: 0.87,
    timestamp: fmt(80),
    status: "ready",
    triggerSegmentId: "t4",
  },
];

export const MOCK_ACTION_ITEMS: ActionItem[] = [
  {
    id: "a1",
    text: "Follow up on competitive analysis with product team",
    assignee: "Sarah",
    detectedAt: fmt(60),
    status: "open",
  },
];

export const MOCK_TOPICS: TopicEvent[] = [
  {
    id: "top1",
    topic: "Q2 Strategy Overview",
    startTime: fmt(180),
    endTime: fmt(150),
    color: "#818cf8",
  },
  {
    id: "top2",
    topic: "Voice AI Market",
    startTime: fmt(150),
    endTime: fmt(90),
    color: "#34d399",
  },
  {
    id: "top3",
    topic: "Competitive Landscape",
    startTime: fmt(90),
    color: "#fb923c",
  },
];
