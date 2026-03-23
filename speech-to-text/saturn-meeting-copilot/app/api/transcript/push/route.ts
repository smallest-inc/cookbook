/**
 * POST /api/transcript/push
 * Receives a transcript segment from the Chrome extension and broadcasts it
 * to all connected SSE clients via the transcriptBridge.
 *
 * Body: { text: string, segments?: TranscriptionSegment[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { transcriptBridge } from "@/lib/transcriptBridge";
import { makeSegment } from "@/lib/segment";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-saturn-token",
};

const PUSH_TOKEN = process.env.SATURN_PUSH_TOKEN;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  if (PUSH_TOKEN && req.headers.get("x-saturn-token") !== PUSH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  try {
    const { text, segments } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400, headers: CORS });
    }

    const segment = makeSegment(text, segments?.[0]?.speaker);
    transcriptBridge.push(segment);

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: CORS });
  }
}

