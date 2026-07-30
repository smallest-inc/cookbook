/**
 * Tiny WebSocket proxy: bridges browser WS clients (which cannot set custom
 * headers) to Smallest's WSS endpoints (which require Authorization: Bearer).
 *
 * Listens on ws://localhost:3031 with two routes:
 *   /stt?model=pulse&language=en   →  wss://api.smallest.ai/waves/v1/stt/live?model=pulse&language=en
 *   /tts               →  wss://api.smallest.ai/waves/v1/tts/live
 *
 * Both upstream connections are opened with the SMALLEST_API_KEY env var set
 * in the bearer header. Browser ↔ proxy frames are forwarded transparently
 * in both directions.
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

const ROUTES = {
  "/stt": "wss://api.smallest.ai/waves/v1/stt/live",
  "/tts": "wss://api.smallest.ai/waves/v1/tts/live",
};

const http = createServer((req, res) => {
  // Health check
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Smallest WS proxy. Connect via ws://… upgrade only.\n");
});

const wss = new WebSocketServer({ noServer: true });

http.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const upstreamBase = ROUTES[url.pathname];
  if (!upstreamBase) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  // Preserve any query params the client passed (e.g., ?language=en for STT)
  const upstreamUrl = upstreamBase + (url.search || "");

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    console.log(`[proxy] ${url.pathname} → ${upstreamUrl}`);

    const upstream = new WebSocket(upstreamUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      perMessageDeflate: false,
    });

    // Buffer client → upstream while upstream is still connecting
    const pending = [];
    let upstreamOpen = false;

    upstream.on("open", () => {
      upstreamOpen = true;
      for (const msg of pending) upstream.send(msg);
      pending.length = 0;
    });

    upstream.on("message", (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary });
    });

    // RFC 6455 reserves several close codes that may NOT be sent — they can
    // only be RECEIVED (1005 no-status, 1006 abnormal, 1015 TLS). The 'ws'
    // library throws TypeError if we try to forward those. Map all reserved
    // and unknown codes to 1000 (normal closure) so the proxy can't crash
    // mid-call from a quirky upstream disconnect.
    const SAFE_CLOSE_CODES = new Set([1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014]);
    const safeCode = (code) => (SAFE_CLOSE_CODES.has(code) || (code >= 3000 && code <= 4999)) ? code : 1000;

    upstream.on("close", (code, reason) => {
      console.log(`[proxy] upstream close ${code} ${reason?.toString() || ""}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        try { clientWs.close(safeCode(code), reason?.toString().slice(0, 120)); }
        catch (e) { console.error("[proxy] client close error (ignored):", e.message); }
      }
    });

    upstream.on("error", (err) => {
      console.error("[proxy] upstream error:", err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        try { clientWs.close(1011, "upstream error"); }
        catch (e) { console.error("[proxy] client close error (ignored):", e.message); }
      }
    });

    clientWs.on("message", (data, isBinary) => {
      if (upstreamOpen) upstream.send(data, { binary: isBinary });
      else pending.push(data);
    });

    clientWs.on("close", () => {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)
        upstream.close();
    });

    clientWs.on("error", (err) => {
      console.error("[proxy] client error:", err.message);
      upstream.close();
    });
  });
});

http.listen(PORT, () => {
  console.log(`[proxy] listening on ws://localhost:${PORT}`);
  console.log(`[proxy]   /stt → wss://api.smallest.ai/waves/v1/stt/live`);
  console.log(`[proxy]   /tts → wss://api.smallest.ai/waves/v1/tts/live`);
});

// Last-resort safety net: a single malformed close should never kill the
// process and take both STT and TTS down with it.
process.on("uncaughtException", (err) => {
  console.error("[proxy] uncaughtException (kept alive):", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[proxy] unhandledRejection (kept alive):", reason);
});
