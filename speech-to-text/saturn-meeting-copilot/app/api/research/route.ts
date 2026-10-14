/**
 * POST /api/research
 * Runs a research job: searches Exa and summarizes with OpenAI.
 *
 * Body: { query: string, segmentId?: string }
 * Returns: Insight object
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runResearch, buildInsight } from "@/services/researchAgent";

const anthropic = new Anthropic();

async function classifyResearchIntent(text: string): Promise<string | null> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 80,
    messages: [
      {
        role: "user",
        content:
          `You are classifying transcript utterances for web research triggering.\n` +
          `Input sentence: "${text}"\n\n` +
          `Rules:\n` +
          `1) Trigger only if this is an actual information-seeking question.\n` +
          `2) Do NOT trigger for conversational/meta prompts like: "can I ask you something", "are you there", greetings, confirmations.\n` +
          `3) Do NOT trigger if the sentence is not a question.\n` +
          `4) If triggering, return a concise cleaned query.\n\n` +
          `Respond in EXACTLY one of these formats:\n` +
          `TRIGGER|<clean query>\n` +
          `SKIP`,
      },
    ],
  });

  const textOut =
    message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text?.trim() ??
    "";

  if (!textOut.toUpperCase().startsWith("TRIGGER|")) return null;

  const query = textOut.slice("TRIGGER|".length).trim();
  return query.length > 0 ? query : null;
}

async function summarizeWithClaude(query: string, snippets: string[]): Promise<string[]> {
  const context = snippets.join("\n\n---\n\n");
  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Query: "${query}"\n\nWeb results:\n${context}\n\nRespond in this exact format:\nLINE1: <ultra-short direct answer, 1-6 words max, e.g. "Pittsburgh, Pennsylvania" or "42 million trillion stars">\nLINE2: <one sentence of key context>\nLINE3: <one more interesting detail sentence>\n\nNo headers, no bullets, no labels — just the 3 plain lines.`,
      },
    ],
  });
  const text = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  return text
    .split("\n")
    .map((l) => l.replace(/^LINE\d:\s*/i, "").replace(/^[•\-*]\s*/, "").trim())
    .filter((l) => l.length > 2)
    .slice(0, 3);
}

export async function POST(req: NextRequest) {
  try {
    const { query, segmentId, numResults, detectOnly } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    if (detectOnly) {
      const classified = await classifyResearchIntent(query.trim());
      return NextResponse.json({
        shouldResearch: Boolean(classified),
        query: classified,
      });
    }

    const result = await runResearch(query.trim(), typeof numResults === "number" ? Math.min(10, Math.max(1, numResults)) : 5);

    // Summarize raw snippets with Claude (server-side only)
    try {
      // Truncate each snippet to avoid overloading Claude's context
      const trimmed = result.bullets.map((s) => s.slice(0, 500));
      result.bullets = await summarizeWithClaude(query, trimmed);
    } catch (err) {
      console.error("[/api/research] Claude summarization failed:", err);
      // Show a brief fallback instead of the raw wall of text
      result.bullets = [result.bullets[0]?.slice(0, 120) ?? "No summary available."];
    }

    const insight = buildInsight(result, query, segmentId);

    return NextResponse.json({
      insight: {
        ...insight,
        id: `insight-${Date.now()}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    console.error("[/api/research]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
