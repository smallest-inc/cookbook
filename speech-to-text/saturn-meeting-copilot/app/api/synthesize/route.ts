/**
 * POST /api/synthesize
 * Converts text to speech using smallest.ai Waves TTS.
 * Streams the audio back to the client for low-latency playback.
 *
 * Body: { text: string, voiceId?: string, speed?: number }
 * Returns: audio/wav stream
 */

import { NextRequest } from "next/server";
import { streamSpeech } from "@/services/voiceService";

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId, speed } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Clamp text length to avoid huge TTS requests
    const trimmed = text.slice(0, 1000);

    const ttsResponse = await streamSpeech({
      text: trimmed,
      voiceId,
      speed: typeof speed === "number" ? Math.min(2, Math.max(0.5, speed)) : 1.0,
    });

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: ttsResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream audio back
    return new Response(ttsResponse.body, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    console.error("[/api/synthesize]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
