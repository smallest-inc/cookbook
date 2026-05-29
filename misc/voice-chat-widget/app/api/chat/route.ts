/**
 * LLM streaming via Smallest Electron (OpenAI-compatible chat-completions).
 *
 * Endpoint: POST https://api.smallest.ai/waves/v1/chat/completions
 * Model:    electron
 * Auth:     SMALLEST_API_KEY  (the same key used for STT + TTS)
 *
 * Output protocol: plain text tokens streamed over the response body. The
 * client reads via fetch + ReadableStream and feeds chunks straight into the
 * TTS pipe at sentence boundaries.
 */
export const runtime = "edge";

const ELECTRON_URL = "https://api.smallest.ai/waves/v1/chat/completions";

async function* electronStream(userText: string, key: string) {
  const r = await fetch(ELECTRON_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "electron",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are a concise, friendly voice assistant. Reply in 2-4 short sentences max. " +
            "Speak naturally, like a real conversation. Do not use markdown formatting.",
        },
        { role: "user", content: userText },
      ],
    }),
  });
  if (!r.ok || !r.body) {
    const errBody = await r.text().catch(() => "");
    throw new Error(`Electron ${r.status}: ${errBody.slice(0, 200)}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const m = JSON.parse(payload);
        const tok = m.choices?.[0]?.delta?.content;
        if (tok) yield tok;
      } catch {}
    }
  }
}

export async function POST(req: Request) {
  const { message } = await req.json();
  const key = process.env.SMALLEST_API_KEY;
  if (!key) {
    return new Response("Missing SMALLEST_API_KEY in env", { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const tok of electronStream(message, key)) controller.enqueue(enc.encode(tok));
      } catch (e: any) {
        controller.enqueue(enc.encode(`\n[error: ${e.message ?? "stream failed"}]`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
