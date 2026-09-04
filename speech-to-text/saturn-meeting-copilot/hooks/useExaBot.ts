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

  // Reset when meeting resets
  useEffect(() => {
    if (status === "idle") {
      processedIds.current.clear();
    }
  }, [status]);

  useEffect(() => {
    // Only run while the meeting is active
    if (status !== "listening" && status !== "paused") return;

    // Find segments we haven't processed yet.
    // Wait for a sentence-ending character so we have the full text before detecting questions.
    const newSegments = transcript.filter(
      (seg) =>
        !processedIds.current.has(seg.id) &&
        seg.text.trim().length > 15 &&
        seg.text.trimEnd().endsWith("?")
    );

    for (const segment of newSegments) {
      // Mark immediately so concurrent renders don't double-process
      processedIds.current.add(segment.id);

      (async () => {
        const rawQuestion = segment.text.trim();

        const detectRes = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: rawQuestion, detectOnly: true }),
        });

        if (!detectRes.ok) return;

        const detectPayload = (await detectRes.json()) as {
          shouldResearch: boolean;
          query: string | null;
        };

        if (!detectPayload.shouldResearch || !detectPayload.query) return;

        const query = detectPayload.query;

        const store = useMeetingStore.getState();

        // Mark the transcript segment as a question
        store.updateTranscriptSegment(segment.id, { isQuestion: true });
        store.incrementResearch();
        store.updateCreditBalance(-2);

        // Insert a placeholder insight while research runs
        const insightId = `insight-bot-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

        const topicPreview = query.charAt(0).toUpperCase() + query.slice(1);

        store.addInsight({
          id: insightId,
          topic: topicPreview,
          query,
          bullets: [],
          sources: [],
          confidence: 0,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          status: "researching",
          triggerSegmentId: segment.id,
        });

        try {
          const res = await fetch("/api/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, segmentId: segment.id, numResults: useMeetingStore.getState().researchResultCount }),
          });

          if (!res.ok) throw new Error(`Research API ${res.status}`);

          const { insight } = (await res.json()) as { insight: Insight };

          store.updateInsight(insightId, {
            topic: insight.topic,
            bullets: insight.bullets,
            sources: insight.sources,
            confidence: insight.confidence,
            status: "ready",
          });

          store.setActiveInsight(insightId);
        } catch (err) {
          console.error("[ExaBot] Research failed:", err);
          store.updateInsight(insightId, { status: "error" });
        } finally {
          store.decrementResearch();
        }
      })();
    }
  }, [transcript, status]);
}
