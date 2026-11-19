import { ServerEvent, SessionError } from './types';

const CLEAN_CLOSE_CODES = new Set([1000, 4401, 4403]);
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 5000, 15000];

export interface AtomsClientConfig {
  // Returns a fresh short-lived Agent WebSocket token from your session server
  // (see ../mobile_token_server). Tokens are single-use, so it is called again
  // for every reconnect. The app never holds the Smallest API key.
  getToken: () => Promise<string>;
  sampleRate: number;
  onEvent: (event: ServerEvent) => void;
  onOpen: () => void;
  onClose: (wasClean: boolean, code: number, reason: string) => void;
  onFatalError: (error: SessionError) => void;
}

// Wraps WebSocket with exponential-backoff reconnect for transient drops.
// Connects on start(); user must call close() to teardown. Never retries on
// auth failures (4401/4403) or clean closes (1000).
export class AtomsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;
  private config: AtomsClientConfig;

  constructor(config: AtomsClientConfig) {
    this.config = config;
  }

  start(): void {
    this.explicitlyClosed = false;
    void this.connect();
  }

  sendMicChunk(base64Int16LE: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Int16LE,
    }));
  }

  close(reason: string = 'client end'): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, reason);
    }
    this.ws = null;
  }

  private async connect(): Promise<void> {
    const { getToken, sampleRate } = this.config;

    let token: string;
    try {
      token = await getToken();
    } catch (e) {
      this.config.onFatalError({
        kind: 'network',
        message: e instanceof Error ? e.message : 'could not get a session token',
        retryable: true,
      });
      return;
    }
    // The user may have ended the session while the token request was in flight.
    if (this.explicitlyClosed) return;

    // The token is bound to one agent by the server that minted it, so no
    // agent_id or API key goes on the URL.
    const url =
      'wss://api.smallest.ai/atoms/v1/agent/connect' +
      `?token=${encodeURIComponent(token)}` +
      `&mode=webcall&sample_rate=${sampleRate}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.config.onFatalError({
        kind: 'network',
        message: e instanceof Error ? e.message : 'websocket construction failed',
        retryable: true,
      });
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.config.onOpen();
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as ServerEvent;
        this.config.onEvent(parsed);
      } catch {
        // malformed JSON from server is non-fatal; drop the frame
      }
    };

    ws.onerror = () => {
      // onclose will fire right after; defer handling there
    };

    ws.onclose = (event) => {
      const wasClean = CLEAN_CLOSE_CODES.has(event.code);
      this.config.onClose(wasClean, event.code, event.reason || '');

      if (this.explicitlyClosed || wasClean) return;

      if (event.code === 4401 || event.code === 4403) {
        this.config.onFatalError({
          kind: 'auth',
          message: `auth rejected (${event.code})`,
          retryable: false,
        });
        return;
      }

      if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        this.config.onFatalError({
          kind: 'network',
          message: `reconnect gave up after ${MAX_RECONNECT_ATTEMPTS} attempts`,
          retryable: true,
        });
        return;
      }

      const delay = RECONNECT_BACKOFF_MS[this.reconnectAttempt] ?? 15000;
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => { void this.connect(); }, delay);
    };
  }
}
