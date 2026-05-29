/**
 * Live STT via the **Smallest Vercel AI provider** (smallestai-vercel-provider).
 *
 * Same UX as the raw-WS sibling — partials in the input, finals auto-submit —
 * but the WebSocket handshake, auth, reconnect logic, and the {"type":"close_stream"}
 * frame are all handled by the SDK. The browser doesn't need a proxy.
 *
 * Auth modes:
 *   • `auth: 'query'`   — the API key flows in the WS URL as ?token=…
 *                          Convenient for demos; the key sits in client JS.
 *   • `signedUrl: ()`   — production browser path. Your backend mints a
 *                          short-lived URL the SDK validates server-side.
 *
 * We use `auth: 'query'` here for demo simplicity. In production, swap to
 * the signedUrl pattern documented in the Vercel SDK README.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { smallestai, SmallestAITranscriptionStream } from "smallestai-vercel-provider";

export type STTEvent =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: "open" }
  | { type: "close" }
  | { type: "error"; message: string };

interface UseSTTOpts {
  apiKey: string;
  language?: string;
  onEvent?: (e: STTEvent) => void;
}

// 48k → 16k naive downsample as an inline AudioWorklet — same approach as
// the raw-WS sibling. The SDK takes whatever PCM16 bytes we feed it.
const WORKLET_SRC = `
class PCM16Downsampler extends AudioWorkletProcessor {
  constructor() { super(); this.acc = []; }
  process(inputs) {
    const ch = inputs[0][0]; if (!ch) return true;
    for (let i = 0; i < ch.length; i += 3) this.acc.push(ch[i]);
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

export function usePulseSTT({ apiKey, language = "en", onEvent }: UseSTTOpts) {
  const streamRef = useRef<SmallestAITranscriptionStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState("");

  const stop = useCallback(() => {
    nodeRef.current?.disconnect(); nodeRef.current = null;
    mediaRef.current?.getTracks().forEach((t) => t.stop()); mediaRef.current = null;
    ctxRef.current?.close(); ctxRef.current = null;
    setRecording(false);
    setPartial("");
    // SDK's closeStream() sends {"type":"close_stream"} upstream — the server
    // flushes any buffered audio, runs ITN over the WHOLE utterance, emits
    // is_final + is_last, then closes the WS. Same pattern as the raw-WS
    // sibling, just one method call instead of the explicit JSON send.
    try { streamRef.current?.closeStream(); } catch {}
  }, []);

  const start = useCallback(async () => {
    if (recording) return;

    // === The whole STT setup, via the SDK ===
    //
    // Compare with the raw-WS sibling (~120 lines including WS lifecycle,
    // message parsing, and the close_stream frame): the SDK collapses that
    // surface to a single factory call + an async-iterator consumption loop.
    //
    // Factory signature: transcriptionStream(modelId, streamOptions, perCallConfig)
    //   - streamOptions  → per-utterance behavior (language, ITN flags, etc.)
    //   - perCallConfig  → auth, baseURL, signedUrl
    const stream = smallestai.transcriptionStream(
      "pulse",
      {
        language,
        encoding: "linear16",
        sampleRate: 16000,
        itnNormalize: true,         // camelCase boolean (not the string "true")
        finalizeOnWords: false,     // prevent mid-utterance fragmenting
        eouTimeoutMs: 1000,         // server silence fallback, > VAD threshold
        wordTimestamps: true,
      },
      {
        apiKey,
        auth: "query",              // browser-safe demo path; switch to signedUrl in prod
      } as any                       // demo-only types; signedUrl is the prod shape
    );
    streamRef.current = stream;

    try {
      await stream.connect();
      onEvent?.({ type: "open" });
    } catch (e: any) {
      onEvent?.({ type: "error", message: e?.message ?? "connect failed" });
      return;
    }

    // Consume transcripts via async iteration. The SDK yields the raw
    // server message shape (transcript, is_final, is_last, words, …).
    (async () => {
      try {
        for await (const msg of stream) {
          const text = msg.transcript ?? "";
          if (!text) continue;
          if (msg.is_final) {
            setPartial("");
            onEvent?.({ type: "final", text });
          } else {
            setPartial(text);
            onEvent?.({ type: "partial", text });
          }
        }
        onEvent?.({ type: "close" });
      } catch (e: any) {
        onEvent?.({ type: "error", message: e?.message ?? "stream error" });
      }
    })();

    // === Mic capture — identical to the raw-WS sibling ===
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    mediaRef.current = media;
    const ctx = new AudioContext({ sampleRate: 48000 });
    ctxRef.current = ctx;

    const blob = new Blob([WORKLET_SRC], { type: "application/javascript" });
    const wurl = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(wurl);
    URL.revokeObjectURL(wurl);

    const node = new AudioWorkletNode(ctx, "pcm16-downsampler");
    node.port.onmessage = (e) => {
      // SDK accepts ArrayBuffer / Uint8Array / Buffer for sendAudio.
      try { stream.sendAudio(new Uint8Array(e.data)); } catch {}
    };
    ctx.createMediaStreamSource(media).connect(node);
    nodeRef.current = node;

    setRecording(true);
  }, [apiKey, language, onEvent, recording]);

  useEffect(() => () => stop(), [stop]);

  return { recording, partial, start, stop };
}
