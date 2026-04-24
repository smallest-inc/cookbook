import { ServerEvent, SessionError } from './types';

const CLEAN_CLOSE_CODES = new Set([1000, 4401, 4403]);
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 5000, 15000];

export interface AtomsClientConfig {
  apiKey: string;
  agentId: string;
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
    this.connect();
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

  private connect(): void {
    const { apiKey, agentId, sampleRate } = this.config;
    const url =
      'wss://api.smallest.ai/atoms/v1/agent/connect' +
      `?token=${encodeURIComponent(apiKey)}` +
      `&agent_id=${encodeURIComponent(agentId)}` +
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
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }
}
