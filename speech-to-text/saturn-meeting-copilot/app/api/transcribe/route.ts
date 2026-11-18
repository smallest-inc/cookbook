/**
 * POST /api/transcribe
 * Transcribes an audio file using smallest.ai STT.
 *
 * Body: FormData with "audio" field (audio blob)
 * Returns: { segments, fullText }
 */

import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/services/transcriptionService";

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
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400, headers: CORS });
    }

    const mimeType = audioFile.type || "audio/wav";
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const language = typeof formData.get("language") === "string" ? (formData.get("language") as string) : "en";

    const result = await transcribeAudio(buffer, mimeType, language);

    return NextResponse.json(result, { headers: CORS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[/api/transcribe]", message);
    const isBilling = err instanceof Error && (err as Error & { billingError?: boolean }).billingError;
    return NextResponse.json({ error: message }, { status: isBilling ? 402 : 500, headers: CORS });
  }
}
