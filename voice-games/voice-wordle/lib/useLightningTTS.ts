/**
 * Streaming TTS over Lightning v3.1 WebSocket.
 *
 * Smallest endpoint: wss://api.smallest.ai/waves/v1/tts/live
 *
 * Connection lifecycle (1 ws = 1 utterance):
 *   1. open(text)  → opens ws, first frame is {"type":"auth","key":apiKey}
 *      (bring-your-own-key: the proxy holds the upstream connection open
 *      until it sees this), second frame is the payload with model/voice/text
 *   2. ws receives base64 PCM16 audio chunks → decode → schedule on AudioContext
 *   3. final marker     → close gracefully
 */
import { useCallback, useRef, useState } from "react";

export type TTSWordEvent = { word: string; start_ms: number; end_ms: number };

interface SpeakOpts {
  apiKey: string;          // sent as the first WS frame; see module doc
  text: string;
  voice?: string;
  model?: string;
  sampleRate?: number;
  proxyUrl?: string;       // default: ws://localhost:3051/tts
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
      apiKey,
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

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      try { wsRef.current.close(); } catch {}
    }
    if (ctxRef.current) nextStartRef.current = ctxRef.current.currentTime;

    const base = proxyUrl || `ws://${location.hostname}:3051/tts`;
    const ws = new WebSocket(base);
    wsRef.current = ws;
    setSpeaking(true);
    ensureCtx();

    let receivedAnyAudio = false;
    let reportedError = false;

    ws.onopen = () => {
      onStart?.();
      ws.send(JSON.stringify({ type: "auth", key: apiKey }));
      const payload = {
        model,
        voice_id: voice,
        text,
        sample_rate: sampleRate,
        add_wav_header: false,
        output_format: "pcm" as const,
      };
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (evt) => {
      try {
        const m = JSON.parse(evt.data);
        // Wire shape: { status: "chunk" | "complete" | "error", data: { audio: "<b64 pcm>" } }
        const audioB64 = m.data?.audio ?? m.audio;
        if (audioB64 && typeof audioB64 === "string") {
          receivedAnyAudio = true;
          playPCM16(audioB64, m.sample_rate ?? sampleRate);
        }
        if (m.status === "error") {
          reportedError = true;
          onError?.(JSON.stringify(m.errors ?? m.message ?? m));
          ws.close();
          return;
        }
        const words = m.data?.words ?? m.words;
        if (Array.isArray(words)) words.forEach((w: TTSWordEvent) => onWord?.(w));
        if (m.status === "complete" || m.is_final) {
          ws.close();
        }
      } catch (e) {
        // non-json frame, ignore
      }
    };

    ws.onerror = () => {
      reportedError = true;
      onError?.("Lightning TTS WS error");
    };
    ws.onclose = (evt) => {
      // If the socket closed before any audio ever played and nobody reported
      // an error yet, this is almost always a bad/rejected API key.
      if (!receivedAnyAudio && !reportedError) {
        onError?.(`No audio received before the connection closed (code ${evt.code}${evt.reason ? `: ${evt.reason}` : ""}) — check your API key.`);
      }
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
