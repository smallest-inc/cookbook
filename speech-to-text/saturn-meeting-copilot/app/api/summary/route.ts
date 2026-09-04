/**
 * POST /api/summary
 * Generates a structured meeting summary using Claude.
 *
 * Body: { transcript: string, title?: string, duration?: string }
 * Returns: MeetingSummary object
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ActionItem, MeetingSummary } from "@/types";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { transcript, title = "Meeting", duration = "unknown" } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 });
    }

    const now = new Date().toLocaleTimeString("en-US", { hour12: false });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are analyzing a meeting transcript. Produce a JSON object with this exact shape:

{
  "summary": "<2-4 sentence prose summary of what the meeting covered>",
  "decisions": ["<decision 1>", "<decision 2>"],
  "actionItems": [
    {
      "text": "<what needs to be done — specific and actionable>",
      "assignee": "<name or null>",
      "priority": "<high|medium|low>",
      "deadline": "<deadline if mentioned, e.g. 'by Friday' or 'next sprint', else null>",
      "context": "<one sentence explaining why this task matters based on the meeting>",
      "steps": ["<step 1>", "<step 2>", "<step 3>"]
    }
  ],
  "topics": ["<topic 1>", "<topic 2>", "<topic 3>"]
}

Rules:
- summary: concise narrative, past tense, max 4 sentences
- decisions: things agreed/decided/confirmed, max 6. If none, return []
- actionItems: concrete follow-up tasks, max 8. If none, return []
  - priority: "high" if blocking/urgent, "medium" if important but not blocking, "low" otherwise
  - steps: 2-4 concrete sub-steps needed to complete the task (infer from transcript context)
  - context: ground the task in what was actually discussed
- topics: 3-5 key subjects discussed, 1-3 words each
- Return ONLY valid JSON — no markdown fences, no explanation

Meeting title: ${title}
Duration: ${duration}

Transcript:
${transcript.slice(0, 14000)}`,
        },
      ],
    });

    const raw =
      message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";

    const json = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(json);

    const actionItems: ActionItem[] = (parsed.actionItems ?? []).map(
      (item: {
        text: string;
        assignee?: string | null;
        priority?: string;
        deadline?: string | null;
        context?: string;
        steps?: string[];
      }, i: number) => ({
        id: `action-${Date.now()}-${i}`,
        text: item.text,
        assignee: item.assignee ?? undefined,
        priority: (["high", "medium", "low"].includes(item.priority ?? "") ? item.priority : "medium") as ActionItem["priority"],
        deadline: item.deadline ?? undefined,
        context: item.context ?? undefined,
        steps: item.steps?.filter((s) => typeof s === "string" && s.trim()) ?? undefined,
        detectedAt: now,
        status: "open" as const,
      })
    );

    const summary: MeetingSummary = {
      title,
      duration,
      summary: parsed.summary ?? "No summary available.",
      decisions: parsed.decisions ?? [],
      actionItems,
      topics: parsed.topics ?? [],
    };

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summary generation failed";
    console.error("[/api/summary]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
