/**
 * POST /api/research
 * Runs a research job: searches Exa and summarizes with Claude.
 *
 * Body: { query: string, segmentId?: string }
 * Returns: Insight object
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runResearch, buildInsight } from "@/services/researchAgent";

const anthropic = new Anthropic();

/**
 * Use Claude to decide if the transcript text contains a research-worthy question,
 * and if so, return the clean search query. Returns null if not worth searching.
 */
async function extractResearchQuery(text: string): Promise<string | null> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `You are a strict filter for a meeting research assistant. Read this transcript excerpt and decide if it contains a question that someone would literally Google to get an answer.

If yes, respond with JSON: {"search":true,"query":"<concise search query>"}
If no, respond with JSON: {"search":false}

Only return search:true if the question asks for an objective fact, definition, statistic, or technical explanation that exists on the web.

Always return search:false for:
- Any question directed at a person (contains you, your, me, my, we, us, her, him, they, their)
- Greetings or social questions (how are you, how are you doing, how are you still X)
- Emotional or personal questions (are you upset, do you like me)
- Task delegation (can you ask her, can you send, can you check with)
- Rhetorical questions or statements phrased as questions
- Meeting logistics, scheduling, or coordination
- Anything with no factual answer you could look up

Transcript: ${JSON.stringify(text)}

Respond with JSON only.`,
          },
        ],
      },
    ],
  });
  const raw = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  // Strip markdown code fences if the model wraps the JSON
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed.search === true && typeof parsed.query === "string" ? parsed.query : null;
  } catch {
    console.warn("[/api/research] extractResearchQuery failed to parse:", raw);
    return null;
  }
}

async function summarizeWithClaude(query: string, snippets: string[]): Promise<string[]> {
  const context = snippets.join("\n\n---\n\n");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
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
    const { text, query: rawQuery, segmentId } = await req.json();

    // `text` = raw transcript window (auto-detect mode); `query` = explicit search (direct search)
    let query: string;
    if (rawQuery && typeof rawQuery === "string") {
      // Direct search — skip LLM validation, use the query as-is
      query = rawQuery.trim();
    } else if (text && typeof text === "string") {
      // Auto-detect mode — let Claude decide if it's worth searching and extract the query
      const extracted = await extractResearchQuery(text.trim());
      if (!extracted) {
        return NextResponse.json({ skip: true });
      }
      query = extracted;
    } else {
      return NextResponse.json({ error: "text or query is required" }, { status: 400 });
    }

    const result = await runResearch(query);

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
