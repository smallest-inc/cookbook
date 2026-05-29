/**
 * Tiny WebSocket proxy: bridges browser TTS clients to Lightning v3.1.
 *
 * Only ONE route now (vs two in the raw-WS sibling) because the Smallest
 * Vercel provider streams STT directly from the browser via `auth: 'query'`,
 * so no proxy is needed on the STT path.
 *
 * For streaming TTS, the SDK doesn't yet wrap `/waves/v1/tts/live`, so we
 * keep this thin proxy for the TTS leg — the alternative is the SDK's
 * batch `experimental_generateSpeech`, which sacrifices the streaming-TTS
 * "audio starts before the LLM finishes generating" UX.
 */
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { config as dotenv } from "dotenv";

dotenv({ path: ".env.local" });

const PORT = Number(process.env.PROXY_PORT || 3031);
const API_KEY = process.env.SMALLEST_API_KEY;
if (!API_KEY) {
  console.error("[proxy] SMALLEST_API_KEY is not set; refusing to start.");
  process.exit(1);
}

const TTS_UPSTREAM = "wss://api.smallest.ai/waves/v1/tts/live";

const http = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Smallest TTS WS proxy. Connect via ws://… /tts upgrade only.\n");
});

const wss = new WebSocketServer({ noServer: true });

// RFC 6455 reserves some close codes as receive-only (1005/1006/1015).
// Map anything outside the sendable set to 1000 so the proxy can never crash.
const SAFE_CLOSE_CODES = new Set([1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014]);
const safeCode = (code) => (SAFE_CLOSE_CODES.has(code) || (code >= 3000 && code <= 4999)) ? code : 1000;

http.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/tts") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (clientWs) => {
    console.log(`[proxy] /tts → ${TTS_UPSTREAM}`);
    const upstream = new WebSocket(TTS_UPSTREAM, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      perMessageDeflate: false,
    });

    const pending = [];
    let upstreamOpen = false;
    upstream.on("open", () => { upstreamOpen = true; for (const m of pending) upstream.send(m); pending.length = 0; });
    upstream.on("message", (data, isBinary) => { if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary }); });
    upstream.on("close", (code, reason) => {
      console.log(`[proxy] upstream close ${code} ${reason?.toString() || ""}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        try { clientWs.close(safeCode(code), reason?.toString().slice(0, 120)); } catch (e) { console.error("[proxy] client close error:", e.message); }
      }
    });
    upstream.on("error", (err) => {
      console.error("[proxy] upstream error:", err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        try { clientWs.close(1011, "upstream error"); } catch {}
      }
    });

    clientWs.on("message", (data, isBinary) => { if (upstreamOpen) upstream.send(data, { binary: isBinary }); else pending.push(data); });
    clientWs.on("close", () => { if (upstream.readyState <= WebSocket.OPEN) upstream.close(); });
    clientWs.on("error", (err) => { console.error("[proxy] client error:", err.message); upstream.close(); });
  });
});

http.listen(PORT, () => {
  console.log(`[proxy] listening on ws://localhost:${PORT}`);
  console.log(`[proxy]   /tts → ${TTS_UPSTREAM}`);
  console.log(`[proxy]   (STT goes browser-direct via smallestai-vercel-provider; no proxy needed)`);
});

process.on("uncaughtException", (err) => console.error("[proxy] uncaughtException (kept alive):", err.message));
process.on("unhandledRejection", (reason) => console.error("[proxy] unhandledRejection (kept alive):", reason));
