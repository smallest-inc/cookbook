import { NextRequest, NextResponse } from "next/server";

const TTS_API = "https://waves-api.smallest.ai/api/v1/lightning-v2/get_speech";
const VOICES_API =
  "https://waves-api.smallest.ai/api/v1/lightning-v2/get_voices";

export async function POST(request: NextRequest) {
  try {
    const { text, voice_id, speed, sample_rate, language, apiKey } =
      await request.json();

    if (!apiKey || !text) {
      return NextResponse.json(
        { error: "API key and text are required" },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: "Text must be under 2000 characters" },
        { status: 400 }
      );
    }

    const res = await fetch(TTS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: voice_id || "ashley",
        speed: speed || 1.0,
        sample_rate: sample_rate || 24000,
        language: language || "en",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `TTS API error: ${err}` },
        { status: res.status }
      );
    }

    const pcm = await res.arrayBuffer();
    const wav = addWavHeader(new Uint8Array(pcm), sample_rate || 24000);

    return new NextResponse(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": wav.byteLength.toString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key required in x-api-key header" },
      { status: 401 }
    );
  }

  try {
    const res = await fetch(VOICES_API, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch voices" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch voices" },
      { status: 500 }
    );
  }
}

function addWavHeader(
  pcm: Uint8Array,
  sampleRate: number,
  channels = 1,
  bitsPerSample = 16
): ArrayBuffer {
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(pcm);
  return buffer;
}
