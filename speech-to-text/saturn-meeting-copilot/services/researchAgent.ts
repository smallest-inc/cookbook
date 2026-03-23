/**
 * Research agent — combines Exa search with heuristic summarization.
 * Detects questions in transcript text and produces structured insights.
 */

import { searchExa } from "./exaSearchService";
import type { Insight, Source } from "@/types";

export interface ResearchResult {
  topic: string;
  bullets: string[];
  sources: Source[];
  confidence: number;
}

const QUESTION_STARTERS =
  /^\s*(what|when|where|who|why|how|which|is|are|was|were|do|does|did|can|could|would|should|will|whom|whose)\b/i;

// Short social/delegation phrases that are never worth researching
const SOCIAL_PATTERNS =
  /^\s*(hey|hi|hello|how are you|how's it going|how are things|can you (ask|tell|send|email|message|let|ping|check with|follow up)|could you (ask|tell|send)|would you (mind|be able)|do you have a (minute|second|moment)|are you (free|available|there|okay|good)|is (everyone|anybody|someone) (ready|there|on)|what do you think|how about you|how was your)/i;


/**
 * Detect whether a segment contains a question and return just that question.
 * Splits on sentence boundaries so "We did great. But what is the budget?"
 * returns "what is the budget" rather than the full segment text.
 */
export async function detectQuestion(text: string): Promise<string | null> {
  // Split on sentence-ending punctuation, keeping each fragment with its delimiter
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (s.length < 8) continue;
    if ((s.endsWith("?") || QUESTION_STARTERS.test(s)) && !SOCIAL_PATTERNS.test(s)) {
      const query = s.replace(/[?!]+$/, "").trim();
      if (query.length > 0) return query;
    }
  }

  return null;
}

/**
 * Run the full research pipeline: fetch Exa results.
 * Summarization is handled server-side in the API route.
 */
export async function runResearch(query: string): Promise<ResearchResult> {
  const { results } = await searchExa(query, 5);

  if (results.length === 0) {
    return {
      topic: query,
      bullets: ["No results found for this query."],
      sources: [],
      confidence: 0.1,
    };
  }

  const sources: Source[] = results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
  }));

  // Return raw snippets — the API route will summarize with Claude
  const bullets = results
    .slice(0, 4)
    .map((r) => r.snippet || r.text || "")
    .filter((s) => s.length > 15);

  return {
    topic: query,
    bullets,
    sources,
    confidence: Math.min(0.4 + results.length * 0.1, 0.85),
  };
}

/**
 * Build a full Insight object from a research result.
 */
export function buildInsight(
  result: ResearchResult,
  query: string,
  triggerSegmentId?: string
): Omit<Insight, "id"> {
  return {
    topic: result.topic,
    query,
    bullets: result.bullets,
    sources: result.sources,
    confidence: result.confidence,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
    status: "ready",
    triggerSegmentId,
  };
}
