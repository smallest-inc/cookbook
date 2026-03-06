// Force Node.js runtime (not edge) so ws native modules work
export const runtime = "nodejs";

import WebSocket from "ws";

const WS_URL =
  "wss://waves-api.smallest.ai/api/v1/lightning-v3.2/get_speech/stream?timeout=180";

export async function POST(request) {
  const { text, voice_id, emotion, pitch, volume, prosody, accent } =
    await request.json();

  if (!text || !voice_id) {
    return new Response(
      JSON.stringify({ error: "text and voice_id required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // BYOK: accept user-provided key via header, fall back to server env
  const apiKey =
    request.headers.get("x-smallest-key") || process.env.SMALLEST_API_KEY;
  const ttsMsg = { text: text.slice(0, 500), voice_id };
  if (emotion) ttsMsg.emotion = emotion;
  if (pitch) ttsMsg.pitch = pitch;
  if (volume) ttsMsg.volume = volume;
  if (prosody) ttsMsg.prosody = prosody;
  if (accent) ttsMsg.accent = accent;

  // Fresh WebSocket per request — avoids voice bleed from pooled connections
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const sendSSE = (data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      const cleanup = (ws) => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
        try { ws.close(); } catch {}
      };

      let ws;
      try {
        ws = await new Promise((resolve, reject) => {
          const conn = new WebSocket(WS_URL, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          const t = setTimeout(() => {
            conn.terminate();
            reject(new Error("WS connect timeout"));
          }, 8000);
          conn.on("open", () => { clearTimeout(t); resolve(conn); });
          conn.on("error", (e) => { clearTimeout(t); reject(e); });
        });
      } catch (err) {
        sendSSE({ error: `Connection failed: ${err.message}` });
        closed = true;
        try { controller.close(); } catch {}
        return;
      }

      const timeout = setTimeout(() => {
        sendSSE({ error: "Timeout" });
        cleanup(ws);
      }, 30000);

      ws.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.status === "chunk" && data.data?.audio) {
            sendSSE({ audio: data.data.audio });
          } else if (data.status === "complete") {
            clearTimeout(timeout);
            sendSSE({ done: true });
            cleanup(ws);
          } else if (data.status === "error") {
            clearTimeout(timeout);
            sendSSE({ error: data.error?.message || "TTS error" });
            cleanup(ws);
          }
        } catch {}
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        sendSSE({ error: err.message });
        cleanup(ws);
      });

      ws.on("close", () => {
        clearTimeout(timeout);
        if (!closed) {
          sendSSE({ done: true });
          closed = true;
          try { controller.close(); } catch {}
        }
      });

      // Fire the TTS request
      ws.send(JSON.stringify(ttsMsg));
      ws.send(JSON.stringify({ flush: true }));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
