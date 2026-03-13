/**
 * GET /api/transcript/stream
 * Server-Sent Events endpoint. The Saturn frontend subscribes here to receive
 * live TranscriptSegment objects pushed by the Chrome extension.
 */

import { transcriptBridge } from "@/lib/transcriptBridge";
import type { TranscriptSegment } from "@/types";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Initial ping so the client knows the connection is live
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      unsubscribe = transcriptBridge.subscribe((segment: TranscriptSegment) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(segment)}\n\n`));
        } catch {
          // Client disconnected mid-stream — ignore
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
