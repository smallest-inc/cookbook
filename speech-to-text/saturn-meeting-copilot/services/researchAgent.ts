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

const NON_RESEARCH_PATTERNS = [
  /^(yes,?\s*)?(can|could|may) i ask you (something|a question|one thing)$/i,
  /^(can|could) i ask (you )?(something|a question|one thing)$/i,
  /^(are you there|can you hear me|am i audible|you there)$/i,
  /^(hi|hello|hey|yo|okay|ok|right|cool|sure)$/i,
];

const NON_RESEARCH_PHRASES = [
  "ask you something",
  "ask you a question",
  "question for you",
  "can i ask",
  "are you there",
  "can you hear me",
  "am i audible",
];


/**
 * Detect whether a sentence is a question or research trigger.
 * Returns the full natural-language query for Exa (useAutoprompt handles semantics).
 */
export async function detectQuestion(text: string): Promise<string | null> {
  const hasQuestionMark = text.trimEnd().endsWith("?");
  if (!hasQuestionMark && !QUESTION_STARTERS.test(text)) return null;

  const query = text.replace(/[?!]+$/, "").trim();
  if (query.length < 10) return null;

  if (NON_RESEARCH_PATTERNS.some((pattern) => pattern.test(query))) return null;

  const lowered = query.toLowerCase();
  if (NON_RESEARCH_PHRASES.some((phrase) => lowered.includes(phrase))) return null;

  return query;
}

/**
 * Run the full research pipeline: fetch Exa results.
 * Summarization is handled server-side in the API route.
 */
export async function runResearch(query: string, numResults = 5): Promise<ResearchResult> {
  const { results } = await searchExa(query, numResults);

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
