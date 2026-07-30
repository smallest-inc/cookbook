/**
 * Thin wrapper around the Hydra WebSocket.
 *
 * Every frame is JSON, every event is keyed by `type`. This class hides
 * the JSON.parse/stringify dance and dispatches typed events to listeners.
 *
 * Connection target (production):
 *   wss://api.smallest.ai/waves/v1/s2s?model=hydra&api_key=<KEY>
 */

import type { ClientEvent, ServerEvent } from "@/app/types";

export const DEFAULT_HYDRA_WS_URL =
  "wss://api.smallest.ai/waves/v1/s2s?model=hydra";

export type HydraStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closing"
  | "closed"
  | "error";

export interface HydraClientOptions {
  url: string;
  apiKey?: string;
  onEvent: (evt: ServerEvent) => void;
  onSent?: (evt: ClientEvent) => void;
  onStatus?: (status: HydraStatus, err?: Error) => void;
}

export class HydraClient {
  private ws: WebSocket | null = null;
  private opts: HydraClientOptions;
  private status: HydraStatus = "idle";

  constructor(opts: HydraClientOptions) {
    this.opts = opts;
  }

  connect(): void {
    if (this.ws) return;
    const url = this.buildUrl();
    this.setStatus("connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (e) {
      this.setStatus("error", e as Error);
      return;
    }
    this.ws = socket;
    socket.onopen = () => this.setStatus("open");
    socket.onclose = () => {
      this.ws = null;
      this.setStatus("closed");
    };
    socket.onerror = () => this.setStatus("error", new Error("ws error"));
    socket.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as ServerEvent;
        this.opts.onEvent(evt);
      } catch {
        // ignore non-JSON frames
      }
    };
  }

  send(evt: ClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(evt));
    this.opts.onSent?.(evt);
  }

  close(): void {
    if (!this.ws) return;
    this.setStatus("closing");
    try {
      this.ws.close();
    } catch {}
    this.ws = null;
  }

  getStatus(): HydraStatus {
    return this.status;
  }

  private setStatus(s: HydraStatus, err?: Error) {
    this.status = s;
    this.opts.onStatus?.(s, err);
  }

  private buildUrl(): string {
    const u = new URL(this.opts.url);
    if (this.opts.apiKey) {
      u.searchParams.set("api_key", this.opts.apiKey);
    }
    if (!u.searchParams.get("model")) {
      u.searchParams.set("model", "hydra");
    }
    return u.toString();
  }
}
