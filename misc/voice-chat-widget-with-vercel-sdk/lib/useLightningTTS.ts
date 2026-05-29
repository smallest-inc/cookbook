/**
 * Streaming TTS over Lightning v3.1 WebSocket.
 *
 * Smallest endpoint: wss://api.smallest.ai/waves/v1/tts/live
 *
 * Connection lifecycle (1 ws = 1 utterance):
 *   1. open(text)        → opens ws, sends payload with model + voice + sample_rate
 *   2. ws receives base64 PCM16 audio chunks → decode → schedule on AudioContext
 *   3. final marker     → close gracefully
 *
 * Word-level timestamps are decorated on the response when supported so the UI
 * can highlight the current word being spoken.
 */
import { useCallback, useRef, useState } from "react";

export type TTSWordEvent = { word: string; start_ms: number; end_ms: number };

interface SpeakOpts {
  apiKey: string;          // unused — proxy adds Bearer header server-side, kept for API stability
  text: string;
  voice?: string;
  model?: string;
  sampleRate?: number;
  proxyUrl?: string;       // default: ws://localhost:3031/tts
  onWord?: (w: TTSWordEvent) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
}

export function useLightningTTS() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      nextStartRef.current = ctxRef.current.currentTime;
    } else if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const playPCM16 = (b64: string, sampleRate: number) => {
    const ctx = ensureCtx();
    const bin = atob(b64);
    const len = bin.length / 2;
    const f32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const lo = bin.charCodeAt(i * 2);
      const hi = bin.charCodeAt(i * 2 + 1);
      let s = (hi << 8) | lo;
      if (s & 0x8000) s = s - 0x10000;
      f32[i] = s / 0x8000;
    }
    const buf = ctx.createBuffer(1, len, sampleRate);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);

    const startAt = Math.max(nextStartRef.current, ctx.currentTime);
    src.start(startAt);
    nextStartRef.current = startAt + buf.duration;
  };

  const speak = useCallback((opts: SpeakOpts) => {
    const {
      text,
      voice = "avery",
      model = "lightning_v3.1",
      sampleRate = 24000,
      proxyUrl,
      onWord,
      onStart,
      onEnd,
      onError,
    } = opts;

    if (!text.trim()) return;

    // Always tear down any in-flight TTS before starting a new one — important
    // for the replay button while the chat-mode queue might still be active.
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      try { wsRef.current.close(); } catch {}
    }
    // Reset playback clock so the new utterance plays immediately.
    if (ctxRef.current) nextStartRef.current = ctxRef.current.currentTime;

    // Connect to local proxy → upstream Lightning TTS WS (proxy injects auth header)
    const base = proxyUrl || `ws://${location.hostname}:3031/tts`;
    const ws = new WebSocket(base);
    wsRef.current = ws;
    setSpeaking(true);
    ensureCtx();

    ws.onopen = () => {
      onStart?.();
      const payload = {
        model,
        voice_id: voice,
        text,
        sample_rate: sampleRate,
        add_wav_header: false,
        output_format: "pcm" as const,    // valid enum: wav|ulaw|alaw|pcm|mp3
      };
      console.log("[tts] →", { ...payload, text: text.slice(0, 60) });
      ws.send(JSON.stringify(payload));
    };

    let firstFrameLogged = false;
    ws.onmessage = (evt) => {
      try {
        const m = JSON.parse(evt.data);
        // Wire shape: { status: "chunk" | "complete" | "error", data: { audio: "<b64 pcm>" } }
        const audioB64 = m.data?.audio ?? m.audio;
        if (audioB64 && typeof audioB64 === "string") {
          if (!firstFrameLogged) {
            console.log("[tts] first chunk", audioB64.length, "b64 chars");
            firstFrameLogged = true;
          }
          playPCM16(audioB64, m.sample_rate ?? sampleRate);
        }
        if (m.status === "error") {
          console.error("[tts] server error:", m);
          onError?.(JSON.stringify(m.errors ?? m.message ?? m));
          ws.close();
          return;
        }
        // Word timestamps (when supported in a future frame type)
        const words = m.data?.words ?? m.words;
        if (Array.isArray(words)) words.forEach((w: TTSWordEvent) => onWord?.(w));
        if (m.status === "complete" || m.is_final) {
          ws.close();
        }
      } catch (e) {
        console.warn("[tts] non-json frame", e);
      }
    };

    ws.onerror = () => onError?.("Lightning TTS WS error");
    ws.onclose = () => {
      onEnd?.();
      setSpeaking(false);
      wsRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setSpeaking(false);
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
      nextStartRef.current = 0;
    }
  }, []);

  return { speak, stop, speaking };
}
