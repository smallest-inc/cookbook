"use client";

/**
 * useGoogleMeetTranscript
 *
 * Two parallel paths when the meeting is "listening":
 *
 * 1. SSE listener  — receives segments pushed by the Chrome extension (Google Meet).
 * 2. Mic → WAV → Smallest.ai STT — captures raw PCM via Web Audio API, encodes
 *    as 16-bit 16kHz WAV (the format Pulse requires), and sends to /api/transcribe.
 */

import { useEffect, useRef } from "react";
import { useMeetingStore } from "@/store/meetingStore";
import type { TranscriptSegment, SttStatus } from "@/types";

const SAMPLE_RATE = 16_000;      // Hz — optimal for STT
const CHUNK_SECONDS = 5;         // seconds of audio per request
const SILENCE_RMS = 0.002;       // skip chunks that are nearly silent

const SPEAKER_COLORS = ["#818cf8", "#34d399", "#fb923c", "#f472b6", "#38bdf8", "#a3e635"];

// ── Helpers ────────────────────────────────────────────────────────────────

function speakerColor(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

function makeSegment(text: string, rawSpeaker?: string): TranscriptSegment {
  const speaker = rawSpeaker ?? "You";
  return {
    id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    speaker,
    speakerColor: speakerColor(speaker),
    text: text.trim(),
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
    isQuestion: text.trimEnd().endsWith("?"),
    isHighlighted: false,
    words: [],
  };
}

// ── WAV encoder (16-bit PCM mono) ──────────────────────────────────────────

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const byteCount = samples.length * 2;
  const buf = new ArrayBuffer(44 + byteCount);
  const view = new DataView(buf);

  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  str(0, "RIFF");
  view.setUint32(4, 36 + byteCount, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);         // chunk size
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);          // block align
  view.setUint16(34, 16, true);         // bits per sample
  str(36, "data");
  view.setUint32(40, byteCount, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }

  return new Blob([buf], { type: "audio/wav" });
}

// ── Web Speech fallback (used when Smallest.ai credits are exhausted) ──────

function startWebSpeechFallback(
  addSegment: (s: TranscriptSegment) => void,
  mkSeg: (text: string, speaker?: string) => TranscriptSegment,
  setStatus: (s: SttStatus, e?: string | null) => void,
  stopRef: { current: boolean }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!Ctor) { setStatus("error", "No STT available. Add Smallest.ai Pulse credits to continue."); return; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec: any = new Ctor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = "en-US";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        const text = e.results[i][0].transcript?.trim();
        if (text) addSegment(mkSeg(text));
      }
    }
  };
  rec.onend = () => { if (!stopRef.current) try { rec.start(); } catch { /* already running */ } };
  rec.start();
  setStatus("listening");
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useGoogleMeetTranscript() {
  const { status, addTranscriptSegment, setSttStatus } = useMeetingStore();
  const stopRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Always-on SSE: auto-start meeting when extension sends first segment ──
  // This runs regardless of meeting status so the Chrome extension can drive
  // Saturn without the user manually pressing "Start Meeting".
  useEffect(() => {
    const es = new EventSource("/api/transcript/stream");

    es.onmessage = (e) => {
      if (!e.data || e.data === "{}") return;
      try {
        const segment = JSON.parse(e.data) as TranscriptSegment;
        const store = useMeetingStore.getState();
        // Auto-start the meeting on the first extension segment
        if (store.status === "idle" || store.status === "ended") {
          store.startMeeting();
        }
        // Re-read status after potential startMeeting mutation
        const currentStatus = useMeetingStore.getState().status;
        if (currentStatus === "listening" || currentStatus === "paused") {
          store.addTranscriptSegment(segment);
        }
      } catch { /* skip malformed */ }
    };

    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-once — store access via getState() avoids stale closure

  useEffect(() => {
    if (status !== "listening") {
      stopRef.current = true;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      esRef.current?.close();
      esRef.current = null;
      setSttStatus("idle");
      return;
    }

    stopRef.current = false;

    // ── Path 1: SSE is handled by the always-on listener mounted above.
    // No second connection needed here.

    // ── Path 2: mic → 16-bit WAV → Smallest.ai Pulse STT ────────────────
    async function startMicCapture() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        setSttStatus("error", "Microphone access denied.");
        return;
      }

      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      // Load an AudioWorklet processor inline via a blob URL — avoids the
      // deprecated ScriptProcessor API entirely.
      const workletSrc = `
class PCMCollector extends AudioWorkletProcessor {
  constructor() { super(); this._buf = []; this._n = 0; }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch) { this._buf.push(new Float32Array(ch)); this._n += ch.length; }
    if (this._n >= ${SAMPLE_RATE * CHUNK_SECONDS}) {
      this.port.postMessage(this._buf);
      this._buf = []; this._n = 0;
    }
    return true;
  }
}
registerProcessor('saturn-pcm-collector', PCMCollector);
      `.trim();

      const workletURL = URL.createObjectURL(
        new Blob([workletSrc], { type: "application/javascript" })
      );
      await audioCtx.audioWorklet.addModule(workletURL);
      URL.revokeObjectURL(workletURL);

      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, "saturn-pcm-collector");

      worklet.port.onmessage = async (e: MessageEvent<Float32Array[]>) => {
        if (stopRef.current) return;
        const batch: Float32Array[] = e.data;

        const merged = new Float32Array(batch.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const c of batch) { merged.set(c, offset); offset += c.length; }

        // Skip silence
        const rms = Math.sqrt(merged.reduce((s, v) => s + v * v, 0) / merged.length);
        if (rms < SILENCE_RMS) return;

        setSttStatus("transcribing");

        try {
          const wav = encodeWAV(merged, SAMPLE_RATE);
          const formData = new FormData();
          formData.append("audio", wav, "chunk.wav");

          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg: string = body?.error ?? `STT error ${res.status}`;
            // 402/403 = no STT credits — fall back to Web Speech API silently
            if (res.status === 402 || res.status === 403) {
              startWebSpeechFallback(addTranscriptSegment, makeSegment, setSttStatus, stopRef);
              return;
            }
            // 503 = Smallest.ai temporarily down — skip chunk, keep trying
            if (res.status === 503) {
              setSttStatus("listening");
              return;
            }
            setSttStatus("error", msg);
            return;
          }

          const { fullText, segments } = await res.json();
          if (fullText?.trim()) {
            addTranscriptSegment(makeSegment(fullText, segments?.[0]?.speaker));
          }
        } catch (err) {
          console.warn("[Saturn] STT chunk error:", err);
        }

        if (!stopRef.current) setSttStatus("listening");
      };

      source.connect(worklet);
      worklet.connect(audioCtx.destination);
      setSttStatus("listening");

      // Hold until stopped
      await new Promise<void>((resolve) => {
        const id = setInterval(() => { if (stopRef.current) { clearInterval(id); resolve(); } }, 250);
      });

      worklet.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await audioCtx.close();
      setSttStatus("idle");
    }

    startMicCapture();

    return () => {
      stopRef.current = true;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      esRef.current?.close();
      esRef.current = null;
      setSttStatus("idle");
    };
  }, [status, addTranscriptSegment, setSttStatus]);
}
