"use client";

/**
 * useExaBot — the Exa research bot hook.
 *
 * Joins the meeting when it starts and listens to the live transcript.
 * When a question is detected in a segment, it automatically:
 *   1. Marks the segment as a question
 *   2. Creates a "researching" insight placeholder
 *   3. Calls /api/research to fetch Exa results
 *   4. Updates the insight to "ready" with real data
 *
 * Usage: call useExaBot() once at the top level of your meeting page.
 */

import { useEffect, useRef } from "react";
import { useMeetingStore } from "@/store/meetingStore";
import type { Insight } from "@/types";

export function useExaBot() {
  const status = useMeetingStore((s) => s.status);
  const transcript = useMeetingStore((s) => s.transcript);

  // Track which segment IDs have already been processed
  const processedIds = useRef(new Set<string>());
  // Track segment IDs that were part of a question window that already fired research
  const questionWindowIds = useRef(new Set<string>());

  // Reset when meeting resets
  useEffect(() => {
    if (status === "idle") {
      processedIds.current.clear();
      questionWindowIds.current.clear();
    }
  }, [status]);

  // How many consecutive same-speaker segments to combine before question detection
  const SPEAKER_WINDOW = 5;

  useEffect(() => {
    // Only run while the meeting is active
    if (status !== "listening" && status !== "paused") return;

    const newSegments = transcript.filter(
      (seg) =>
        !processedIds.current.has(seg.id) &&
        seg.text.trim().length > 5
    );

    for (const segment of newSegments) {
      // Mark immediately so concurrent renders don't double-process
      processedIds.current.add(segment.id);

      const segIdx = transcript.indexOf(segment);

      // Build a sliding window of the last SPEAKER_WINDOW segments from the same speaker
      const window = transcript
        .slice(0, segIdx + 1)
        .filter((s) => s.speaker === segment.speaker)
        .slice(-SPEAKER_WINDOW);

      // Skip if any segment in this window already triggered a research job
      if (window.some((s) => questionWindowIds.current.has(s.id))) continue;

      const combinedText = window.map((s) => s.text).join(" ");

      (async () => {
        const store = useMeetingStore.getState();
        store.incrementResearch();

        try {
          const res = await fetch("/api/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: combinedText, segmentId: segment.id }),
          });

          if (!res.ok) throw new Error(`Research API ${res.status}`);

          const body = await res.json();

          if (body.skip) return;

          const { insight } = body as { insight: Insight };

          // Mark window only after confirmed research — prevents race condition where
          // an in-flight skip would block a concurrent different question in the same window
          window.forEach((s) => questionWindowIds.current.add(s.id));
          window.forEach((s) => store.updateTranscriptSegment(s.id, { isQuestion: true }));
          store.updateCreditBalance(-2);

          const insightId = `insight-bot-${Date.now()}-${Math.random().toString(36).slice(2)}`;

          store.addInsight({
            id: insightId,
            topic: insight.topic,
            query: insight.query,
            bullets: insight.bullets,
            sources: insight.sources,
            confidence: insight.confidence,
            timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
            status: "ready",
            triggerSegmentId: segment.id,
          });

          store.setActiveInsight(insightId);
        } catch (err) {
          console.error("[ExaBot] Research failed:", err);
        } finally {
          store.decrementResearch();
        }
      })();
    }
  }, [transcript, status]);
}
