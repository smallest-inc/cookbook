"use client";

/**
 * useDirectSearch — push-to-talk direct Exa search.
 *
 * Hold Tab to record, release to transcribe + search Exa directly.
 * Bypasses question detection — whatever you say becomes the query.
 */

import { useEffect, useRef, useState } from "react";
import { useMeetingStore } from "@/store/meetingStore";
import type { Insight } from "@/types";

export type DirectSearchStatus = "idle" | "recording" | "transcribing" | "searching";

export function useDirectSearch() {
  const [status, setStatus] = useState<DirectSearchStatus>("idle");
  // Use a ref so the stable keydown/keyup handlers can read current status
  const statusRef = useRef<DirectSearchStatus>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const updateStatus = (s: DirectSearchStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const runSearch = async (audioBlob: Blob) => {
    updateStatus("transcribing");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "search.webm");

      const transcribeRes = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!transcribeRes.ok) throw new Error("Transcription failed");

      const { fullText } = await transcribeRes.json();
      if (!fullText?.trim()) return;

      const query = fullText.trim();
      updateStatus("searching");

      const store = useMeetingStore.getState();
      store.incrementResearch();
      store.updateCreditBalance(-2);

      const insightId = `insight-direct-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const topicPreview = query
        .split(" ")
        .slice(0, 4)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      store.addInsight({
        id: insightId,
        topic: topicPreview,
        query,
        bullets: [],
        sources: [],
        confidence: 0,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        status: "researching",
      });

      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
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
      console.error("[DirectSearch] Failed:", err);
    } finally {
      useMeetingStore.getState().decrementResearch();
      updateStatus("idle");
    }
  };

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      if (statusRef.current !== "idle") return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunksRef.current = [];

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          runSearch(blob);
        };

        recorder.start();
        updateStatus("recording");
      } catch (err) {
        console.error("[DirectSearch] Mic error:", err);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      if (
        statusRef.current === "recording" &&
        mediaRecorderRef.current?.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []); // stable — all state accessed via refs

  return { directSearchStatus: status };
}
