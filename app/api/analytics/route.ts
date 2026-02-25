import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side analytics proxy to avoid ad-blocker interference.
 * Forwards events to Mixpanel's HTTP API.
 */
export async function POST(request: NextRequest) {
  const token = process.env.MIXPANEL_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "No token" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { event, properties } = body;

    const data = {
      event,
      properties: {
        ...properties,
        token,
        time: Date.now(),
        $insert_id: crypto.randomUUID(),
      },
    };

    const encoded = Buffer.from(JSON.stringify([data])).toString("base64");

    const res = await fetch("https://api.mixpanel.com/track", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encoded}`,
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Mixpanel error" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
