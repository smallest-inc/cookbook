import { NextResponse } from "next/server";

export async function POST(request) {
  const { text, voice_id } = await request.json();

  if (!text || !voice_id) {
    return NextResponse.json(
      { error: "text and voice_id are required" },
      { status: 400 }
    );
  }

  const res = await fetch(
    "https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMALLEST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 1000),
        voice_id,
        sample_rate: 24000,
        speed: 1.0,
        output_format: "mp3",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `TTS API error: ${err}` },
      { status: res.status }
    );
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.byteLength.toString(),
    },
  });
}
