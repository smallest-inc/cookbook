/**
 * WebSocket Connection Pool for Smallest AI TTS API.
 *
 * Maintains persistent WebSocket connections to avoid per-request
 * handshake overhead (DNS + TCP + TLS + WS upgrade ≈ 300-500ms).
 *
 * Uses globalThis singleton to survive Next.js HMR in development.
 */

import WebSocket from "ws";

const WS_URL =
  "wss://waves-api.smallest.ai/api/v1/lightning-v3.2/get_speech/stream?timeout=180";

const MAX_POOL_SIZE = 4;
const CONNECT_TIMEOUT = 5000;
const IDLE_TIMEOUT = 120_000; // 2 min (server timeout is 180s)

class WSPool {
  constructor() {
    this.idle = [];
    this.apiKey = null;
  }

  _getApiKey() {
    if (!this.apiKey) {
      this.apiKey = process.env.SMALLEST_API_KEY;
    }
    return this.apiKey;
  }

  /** Create a new WebSocket connection and wait for it to open. */
  _createConnection() {
    return new Promise((resolve, reject) => {
      const apiKey = this._getApiKey();
      const ws = new WebSocket(WS_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error("WebSocket connection timeout"));
      }, CONNECT_TIMEOUT);

      ws.on("open", () => {
        clearTimeout(timeout);
        resolve(ws);
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /** Acquire a WebSocket — reuses idle connection or creates new one. */
  async acquire() {
    while (this.idle.length > 0) {
      const entry = this.idle.pop();
      clearTimeout(entry.idleTimer);

      if (entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.removeAllListeners("message");
        entry.ws.removeAllListeners("error");
        entry.ws.removeAllListeners("close");
        return entry.ws;
      }
      try { entry.ws.terminate(); } catch {}
    }

    return this._createConnection();
  }

  /** Return a WebSocket to the pool for reuse. */
  release(ws) {
    if (ws.readyState !== WebSocket.OPEN || this.idle.length >= MAX_POOL_SIZE) {
      try { ws.close(); } catch {}
      return;
    }

    ws.removeAllListeners("message");
    ws.removeAllListeners("error");
    ws.removeAllListeners("close");

    const idleTimer = setTimeout(() => {
      const idx = this.idle.findIndex((e) => e.ws === ws);
      if (idx !== -1) this.idle.splice(idx, 1);
      try { ws.close(); } catch {}
    }, IDLE_TIMEOUT);

    this.idle.push({ ws, createdAt: Date.now(), idleTimer });
  }
}

// Singleton — survives HMR in dev via globalThis guard
if (!globalThis.__wsPool) {
  globalThis.__wsPool = new WSPool();
}

export const wsPool = globalThis.__wsPool;
