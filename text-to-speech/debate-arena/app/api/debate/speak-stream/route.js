// Force Node.js runtime (not edge) so ws native modules work
export const runtime = "nodejs";

import WebSocket from "ws";

// Same live TTS endpoint as the other cookbook streaming examples; the model is picked in the message body.
const TTS_MODEL = "lightning_v3.1_pro";
const WS_URL = "wss://api.smallest.ai/waves/v1/tts/live";

// ─── POST handler ──────────────────────────────────────────────────
export async function POST(request) {
  const { text, voice_id, emotion, pitch, volume, prosody, accent } =
    await request.json();

  if (!text || !voice_id) {
    return new Response(
      JSON.stringify({ error: "text and voice_id required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const userKey = request.headers.get("x-smallest-key");
  const apiKey = userKey || process.env.SMALLEST_API_KEY;

  // Cloned voices (voice_...) on the shared server key are limited to an
  // allowlist, so the public demo cannot voice every clone in the org.
  // With their own key, people can use any clone on their own account.
  if (!userKey && voice_id.startsWith("voice_")) {
    const allowed = (process.env.ALLOWED_CLONE_VOICES || "").split(",").map((v) => v.trim()).filter(Boolean);
    if (!allowed.includes(voice_id)) {
      return new Response(
        `data: ${JSON.stringify({ error: "Cloned voices need your own Smallest API key. Add it under 'Enter your API keys'." })}\n\n`,
        { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
      );
    }
  }

  // Roast turns often run past 500 characters; the API takes 2000+ in one message.
  const ttsMsg = { text: text.slice(0, 2000), voice_id, model: TTS_MODEL };
  // Expressive params (emotion, pitch, volume, prosody) are v3.2-only
  // and can cause playback errors on some inputs. Only send them if
  // the endpoint is confirmed to support them reliably.
  // if (emotion) ttsMsg.emotion = emotion;
  // if (pitch) ttsMsg.pitch = pitch;
  // if (volume) ttsMsg.volume = volume;
  // if (prosody) ttsMsg.prosody = prosody;
  if (accent) ttsMsg.accent = accent;

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
          const t = setTimeout(() => { conn.terminate(); reject(new Error("WS connect timeout")); }, 8000);
          conn.on("open", () => { clearTimeout(t); resolve(conn); });
          conn.on("error", (e) => { clearTimeout(t); reject(e); });
          conn.on("unexpected-response", (req, res) => {
            clearTimeout(t);
            conn.terminate();
            const err = new Error(`Unexpected server response: ${res.statusCode}`);
            if (res.statusCode === 401 || res.statusCode === 403) {
              err.userMessage = userKey
                ? "Your Smallest API key was rejected. Check it under 'Enter your API keys'."
                : "The server's Smallest API key was rejected. Add your own key under 'Enter your API keys'.";
            }
            reject(err);
          });
        });
      } catch (err) {
        sendSSE({ error: err.userMessage || `Connection failed: ${err.message}` });
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
            sendSSE({ error: data.error?.message || data.errors?.[0]?.message || data.message || "TTS error" });
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
