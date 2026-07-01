/**
 * Live STT over Pulse WebSocket. Mic → 16 kHz PCM16 → WSS.
 *
 * Smallest endpoint: wss://api.smallest.ai/waves/v1/pulse/get_text
 * Auth: the proxy can't get a header from the browser, and we don't want a
 * shared server-side key (bring-your-own-key), so the very first frame we
 * send is {"type":"auth","key":apiKey} — the proxy reads that and opens the
 * upstream connection with it. Everything after is raw PCM16 audio.
 */
import { useEffect, useRef, useState, useCallback } from "react";

export type STTEvent =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: "error"; message: string }
  | { type: "open" }
  | { type: "close"; code: number; reason: string; cleanBeforeAnyResult: boolean };

interface UseSTTOpts {
  apiKey: string;                // sent as the first WS frame; see module doc
  language?: string;
  onEvent?: (e: STTEvent) => void;
  proxyUrl?: string;             // default: ws://localhost:3051/stt
}

export function usePulseSTT({ apiKey, language = "en", onEvent, proxyUrl }: UseSTTOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState("");

  const stop = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setRecording(false);
    setPartial("");

    // Send {"type":"close_stream"} so the server flushes any buffered
    // audio and runs ITN over the WHOLE utterance, then closes the WS.
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "close_stream" })); } catch {}
    } else {
      wsRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (recording) return;

    const base = proxyUrl || `ws://${location.hostname}:3051/stt`;
    const qs = new URLSearchParams({
      language,
      encoding: "linear16",
      sample_rate: "16000",
      itn_normalize: "true",
      finalize_on_words: "false",
      eou_timeout_ms: "1000",
    });
    const url = `${base}?${qs}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    let gotAnyResult = false;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", key: apiKey }));
      onEvent?.({ type: "open" });
    };
    ws.onclose = (evt) => {
      onEvent?.({ type: "close", code: evt.code, reason: evt.reason, cleanBeforeAnyResult: !gotAnyResult });
    };
    ws.onerror = () => onEvent?.({ type: "error", message: "Pulse WS error" });
    ws.onmessage = (evt) => {
      try {
        const m = JSON.parse(evt.data);
        const text = m.transcription ?? m.transcript ?? m.text ?? "";
        if (text) {
          gotAnyResult = true;
          if (m.is_final) {
            setPartial("");
            onEvent?.({ type: "final", text });
          } else {
            setPartial(text);
            onEvent?.({ type: "partial", text });
          }
        }
      } catch {
        // ignore non-JSON
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 48000 });
    audioCtxRef.current = ctx;

    const workletCode = `
      class PCM16Downsampler extends AudioWorkletProcessor {
        constructor() { super(); this.acc = []; }
        process(inputs) {
          const ch0 = inputs[0][0];
          if (!ch0) return true;
          for (let i = 0; i < ch0.length; i += 3) this.acc.push(ch0[i]);
          if (this.acc.length >= 1600) {
            const buf = new Int16Array(this.acc.length);
            for (let i = 0; i < this.acc.length; i++) {
              const v = Math.max(-1, Math.min(1, this.acc[i]));
              buf[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
            }
            this.port.postMessage(buf.buffer, [buf.buffer]);
            this.acc = [];
          }
          return true;
        }
      }
      registerProcessor("pcm16-downsampler", PCM16Downsampler);
    `;
    const blob = new Blob([workletCode], { type: "application/javascript" });
    const workletUrl = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "pcm16-downsampler");
    node.port.onmessage = (ev) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(ev.data);
    };
    src.connect(node);
    workletNodeRef.current = node;

    setRecording(true);
  }, [apiKey, language, onEvent, recording, proxyUrl]);

  useEffect(() => () => stop(), [stop]);

  return { recording, partial, start, stop };
}
