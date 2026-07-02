/**
 * Tiny WebSocket proxy: bridges browser WS clients (which cannot set custom
 * headers) to Smallest's WSS endpoints (which require Authorization: Bearer).
 *
 * Listens on ws://localhost:3051 with two routes:
 *   /stt?language=en   →  wss://api.smallest.ai/waves/v1/pulse/get_text?language=en
 *   /tts               →  wss://api.smallest.ai/waves/v1/tts/live
 *
 * Bring-your-own-key: the API key is NOT read from the environment. Each
 * client's very first WS message must be a JSON auth frame:
 *   {"type":"auth","key":"<their Smallest API key>"}
 * The proxy holds off opening the upstream connection until it sees this
 * frame, then uses that key as the Bearer token for that connection only —
 * so many players can share one running proxy, each authenticated as
 * themselves. The auth frame itself is never forwarded upstream or logged.
 *
 * NOTE: for a real deployment this proxy must sit behind TLS (wss://), since
 * the key travels from browser to proxy in plaintext otherwise. Fine for
 * local dev over ws://localhost.
 */
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { config as dotenv } from "dotenv";

dotenv({ path: ".env.local" });

const PORT = Number(process.env.PROXY_PORT || 3051);
const AUTH_TIMEOUT_MS = 5000;

const ROUTES = {
  "/stt": "wss://api.smallest.ai/waves/v1/pulse/get_text",
  "/tts": "wss://api.smallest.ai/waves/v1/tts/live",
};

// RFC 6455 reserves several close codes that may NOT be sent (1005/1006/1015
// are receive-only). Map anything unsafe to 1000 so the proxy can't crash
// mid-game from a quirky upstream disconnect.
const SAFE_CLOSE_CODES = new Set([1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014]);
const safeCode = (code) => (SAFE_CLOSE_CODES.has(code) || (code >= 3000 && code <= 4999)) ? code : 1000;

const http = createServer((req, res) => {
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
  const upstreamUrl = upstreamBase + (url.search || "");

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    let upstream = null;
    let upstreamOpen = false;
    let authed = false;
    const pending = [];

    const authTimer = setTimeout(() => {
      if (!authed) {
        console.log(`[proxy] ${url.pathname} closed: no auth frame within ${AUTH_TIMEOUT_MS}ms`);
        try { clientWs.close(4001, "auth timeout"); } catch {}
      }
    }, AUTH_TIMEOUT_MS);

    function connectUpstream(apiKey) {
      console.log(`[proxy] ${url.pathname} → ${upstreamUrl}`);
      upstream = new WebSocket(upstreamUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        perMessageDeflate: false,
      });

      upstream.on("open", () => {
        upstreamOpen = true;
        for (const msg of pending) upstream.send(msg);
        pending.length = 0;
      });

      upstream.on("message", (data, isBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary });
      });

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
    }

    clientWs.on("message", (data, isBinary) => {
      if (!authed) {
        authed = true;
        clearTimeout(authTimer);
        let key = null;
        if (!isBinary) {
          try {
            const msg = JSON.parse(data.toString());
            if (msg && msg.type === "auth" && typeof msg.key === "string" && msg.key.trim()) {
              key = msg.key.trim();
            }
          } catch {
            // not JSON — falls through to the missing-key close below
          }
        }
        if (!key) {
          console.log(`[proxy] ${url.pathname} closed: first frame was not a valid auth frame`);
          try { clientWs.close(4002, "expected {type:'auth', key} as the first message"); } catch {}
          return;
        }
        connectUpstream(key);
        return; // the auth frame itself is never forwarded upstream
      }
      if (upstreamOpen) upstream.send(data, { binary: isBinary });
      else pending.push(data);
    });

    clientWs.on("close", () => {
      clearTimeout(authTimer);
      if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING))
        upstream.close();
    });

    clientWs.on("error", (err) => {
      console.error("[proxy] client error:", err.message);
      upstream?.close();
    });
  });
});

http.listen(PORT, () => {
  console.log(`[proxy] listening on ws://localhost:${PORT}`);
  console.log(`[proxy]   /stt → wss://api.smallest.ai/waves/v1/pulse/get_text`);
  console.log(`[proxy]   /tts → wss://api.smallest.ai/waves/v1/tts/live`);
  console.log(`[proxy]   auth: each client sends {"type":"auth","key":"..."} as its first message`);
});

process.on("uncaughtException", (err) => {
  console.error("[proxy] uncaughtException (kept alive):", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[proxy] unhandledRejection (kept alive):", reason);
});
