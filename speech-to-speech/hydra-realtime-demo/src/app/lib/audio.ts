/**
 * Browser-side audio plumbing for Hydra.
 *
 * - Microphone capture at 16 kHz PCM16 via an inline AudioWorklet that posts
 *   480-sample (30 ms) frames per tick.
 * - Gapless playback of incoming base64 PCM16 deltas at the session sample
 *   rate the server announces in `session.configured`. We keep a handle on
 *   every scheduled AudioBufferSourceNode so we can stop them cleanly on
 *   barge-in — AudioContext.close() alone leaves a tail.
 */

// ──── base64 helpers ────────────────────────────────────────────────────

export function bytesToB64(u8: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(s);
}

export function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

// ──── microphone ────────────────────────────────────────────────────────

const WORKLET_SRC = `
class HydraMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(0);
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const nb = new Float32Array(this.buf.length + ch.length);
    nb.set(this.buf);
    nb.set(ch, this.buf.length);
    this.buf = nb;
    const CHUNK = 480; // 30 ms @ 16 kHz
    while (this.buf.length >= CHUNK) {
      const seg = this.buf.slice(0, CHUNK);
      this.buf = this.buf.slice(CHUNK);
      const i16 = new Int16Array(seg.length);
      let peak = 0;
      for (let i = 0; i < seg.length; i++) {
        const s = Math.max(-1, Math.min(1, seg[i]));
        i16[i] = s < 0 ? s * 32768 : s * 32767;
        const abs = s < 0 ? -s : s;
        if (abs > peak) peak = abs;
      }
      this.port.postMessage({ pcm: i16.buffer, peak }, [i16.buffer]);
    }
    return true;
  }
}
registerProcessor('hydra-mic', HydraMicProcessor);
`;

export interface MicHandle {
  stop: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
}

export interface MicChunk {
  pcm: ArrayBuffer;
  peak: number; // 0..1, last frame
}

export async function startMic(opts: {
  onChunk: (chunk: MicChunk) => void;
  initiallyMuted?: boolean;
}): Promise<MicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    },
  });
  const ctx = new AudioContext({ sampleRate: 16000 });

  const blob = new Blob([WORKLET_SRC], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "hydra-mic");
  let muted = !!opts.initiallyMuted;

  node.port.onmessage = (e: MessageEvent) => {
    const data = e.data as { pcm: ArrayBuffer; peak: number };
    if (muted) {
      // Server-side VAD still expects frames — send silence to keep timing.
      opts.onChunk({ pcm: new ArrayBuffer(data.pcm.byteLength), peak: 0 });
    } else {
      opts.onChunk(data);
    }
  };

  source.connect(node);
  // worklets must connect to destination to be pulled on by some browsers;
  // we route through a muted gain so the user doesn't hear themselves.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(ctx.destination);

  return {
    stop: () => {
      try {
        node.disconnect();
      } catch {}
      try {
        source.disconnect();
      } catch {}
      try {
        sink.disconnect();
      } catch {}
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
    setMuted: (v: boolean) => {
      muted = v;
    },
    isMuted: () => muted,
  };
}

// ──── playback ──────────────────────────────────────────────────────────

export class Playback {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStart = 0;
  private active = new Set<AudioBufferSourceNode>();
  private rate: number;

  constructor(sampleRate: number) {
    this.rate = sampleRate;
  }

  setSampleRate(rate: number) {
    if (rate === this.rate) return;
    this.rate = rate;
    this.stop();
  }

  private ensure() {
    if (this.ctx) return;
    this.ctx = new AudioContext({ sampleRate: this.rate });
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.85;
    this.gain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.nextStart = 0;
  }

  play(buf: ArrayBuffer) {
    this.ensure();
    if (!this.ctx || !this.gain) return;
    const int16 = new Int16Array(buf);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const ab = this.ctx.createBuffer(1, float32.length, this.rate);
    ab.getChannelData(0).set(float32);
    const src = this.ctx.createBufferSource();
    src.buffer = ab;
    src.connect(this.gain);
    const now = this.ctx.currentTime;
    if (this.nextStart === 0) this.nextStart = now + 0.12;
    if (this.nextStart < now) this.nextStart = now + 0.04;
    src.start(this.nextStart);
    this.nextStart += ab.duration;
    this.active.add(src);
    src.onended = () => this.active.delete(src);
  }

  stop() {
    // mute first so anything mid-sample dies even if stop() is slow
    if (this.gain) {
      try {
        this.gain.gain.cancelScheduledValues(0);
        this.gain.gain.setValueAtTime(0, this.gain.context.currentTime);
      } catch {}
    }
    for (const s of this.active) {
      try {
        s.onended = null;
        s.stop();
      } catch {}
      try {
        s.disconnect();
      } catch {}
    }
    this.active.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.gain = null;
      this.analyser = null;
    }
    this.nextStart = 0;
  }

  /** Returns a 0..1 amplitude estimate for the currently playing audio. */
  level(): number {
    if (!this.analyser) return 0;
    const arr = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(arr);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = (arr[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / arr.length) * 2.2);
  }

  isPlaying() {
    return this.active.size > 0;
  }
}
