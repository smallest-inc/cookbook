/**
 * transcriptBridge — server-side in-memory pub/sub for live transcript segments.
 *
 * The Google Meet Chrome extension POSTs segments to /api/transcript/push.
 * The Saturn frontend subscribes to /api/transcript/stream (SSE).
 * This module connects the two using a Node.js EventEmitter.
 *
 * In development (single Node process) this works perfectly.
 * For production scale, swap the EventEmitter for a Redis pub/sub channel.
 */

import { EventEmitter } from "events";
import type { TranscriptSegment } from "@/types";

class TranscriptBridge extends EventEmitter {
  constructor() {
    super();
    // Increase limit to avoid warnings when many SSE clients connect
    this.setMaxListeners(100);
  }

  push(segment: TranscriptSegment) {
    this.emit("segment", segment);
  }

  subscribe(listener: (segment: TranscriptSegment) => void) {
    this.on("segment", listener);
    return () => this.off("segment", listener);
  }
}

// Module singleton — shared across all API route invocations in the same process
const globalForBridge = globalThis as typeof globalThis & {
  _transcriptBridge?: TranscriptBridge;
};

export const transcriptBridge =
  globalForBridge._transcriptBridge ??
  (globalForBridge._transcriptBridge = new TranscriptBridge());
