import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    "https://api.smallest.ai/waves/v1/lightning-v3.1/get_voices",
    {
      headers: {
        Authorization: `Bearer ${process.env.SMALLEST_API_KEY}`,
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `API error: ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  const voices = data.voices || data;
  return NextResponse.json(voices);
}
