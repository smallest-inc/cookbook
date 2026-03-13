/**
 * POST /api/transcript/push
 * Receives a transcript segment from the Chrome extension and broadcasts it
 * to all connected SSE clients via the transcriptBridge.
 *
 * Body: { text: string, segments?: TranscriptionSegment[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { transcriptBridge } from "@/lib/transcriptBridge";
import type { TranscriptSegment } from "@/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { text, segments } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400, headers: CORS });
    }

    const rawSpeaker: string | undefined = segments?.[0]?.speaker;
    const speaker = rawSpeaker ?? "You";

    const segment: TranscriptSegment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      speaker,
      speakerColor: speakerColor(speaker),
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
      isQuestion: text.trimEnd().endsWith("?"),
      isHighlighted: false,
      words: [],
    };

    transcriptBridge.push(segment);

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: CORS });
  }
}

const SPEAKER_COLORS = ["#818cf8", "#34d399", "#fb923c", "#f472b6", "#38bdf8", "#a3e635"];

function speakerColor(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}
