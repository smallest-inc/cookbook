/**
 * Live STT over Pulse WebSocket. Mic → 16 kHz PCM16 → WSS.
 *
 * Smallest endpoint: wss://api.smallest.ai/waves/v1/pulse/get_text
 * Auth: token query parameter (browsers can't set WS Authorization headers).
 */
import { useEffect, useRef, useState, useCallback } from "react";

export type STTEvent =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: "error"; message: string }
  | { type: "open" }
  | { type: "close" };

interface UseSTTOpts {
  apiKey: string;                // unused now — proxy injects the Bearer header server-side, kept for API stability
  language?: string;
  onEvent?: (e: STTEvent) => void;
  proxyUrl?: string;             // default: ws://localhost:3031/stt
}

export function usePulseSTT({ apiKey, language = "en", onEvent, proxyUrl }: UseSTTOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState("");

  const stop = useCallback(() => {
    // Tear down mic + worklet immediately so we stop SENDING audio
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
    // Without this, the WS closes mid-buffer and ITN may not see the
    // full sentence — currency/dates/etc lose context.
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "close_stream" })); } catch {}
      // Server will reply with the final + is_last:true, then close.
      // We DON'T ws.close() here — the server closes after flushing.
    } else {
      wsRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (recording) return;

    // Open local proxy → upstream Pulse WS. The proxy injects the Bearer
    // header server-side because browsers can't set headers on WS connects.
    //
    // Query params sent upstream — this is the RECOMMENDED ITN config from
    // Smallest's docs for agentic / chat flows:
    //   language            - English ('en') by default
    //   encoding            - linear16 = raw 16-bit PCM little-endian
    //   sample_rate         - 16000 Hz, matches our AudioWorklet downsampler
    //   itn_normalize       - "true" (STRING). Numbers/currency/dates/etc
    //                         get normalized in FINAL transcripts.
    //   finalize_on_words   - "false". Disables server-side word-count
    //                         finalizer that fragments utterances mid-stream
    //                         and starves ITN of entity context.
    //   eou_timeout_ms      - 1000. Server's silence-fallback finalizer.
    //                         Set above any client-side VAD threshold so
    //                         the client (or close_stream) wins the race.
    const base = proxyUrl || `ws://${location.hostname}:3031/stt`;
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

    ws.onopen = () => onEvent?.({ type: "open" });
    ws.onclose = () => onEvent?.({ type: "close" });
    ws.onerror = () => onEvent?.({ type: "error", message: "Pulse WS error" });
    ws.onmessage = (evt) => {
      try {
        const m = JSON.parse(evt.data);
        // Pulse emits messages like {is_final: false, transcription: "..."} or {is_final: true, ...}.
        // Tolerant parsing — different versions of the spec have used "text" or "transcript" too.
        const text = m.transcription ?? m.transcript ?? m.text ?? "";
        if (text) {
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

    // Get mic + downsample to 16k PCM16 in an AudioWorklet so we don't block the main thread.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 48000 });
    audioCtxRef.current = ctx;

    // Inline worklet that downsamples 48k float → 16k PCM16 and posts each frame.
    const workletCode = `
      class PCM16Downsampler extends AudioWorkletProcessor {
        constructor() { super(); this.acc = []; }
        process(inputs) {
          const ch0 = inputs[0][0];
          if (!ch0) return true;
          // Naive 3:1 downsample (48k → 16k). Good enough for STT.
          for (let i = 0; i < ch0.length; i += 3) this.acc.push(ch0[i]);
          // Send roughly every 100 ms (1600 samples @ 16k).
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
  }, [apiKey, language, onEvent, recording]);

  useEffect(() => () => stop(), [stop]);

  return { recording, partial, start, stop };
}
