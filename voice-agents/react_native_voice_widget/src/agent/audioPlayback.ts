import { AudioContext } from 'react-native-audio-api';
import { Buffer } from 'buffer';
import { rmsInt16 } from './rms';

export interface PlaybackOptions {
  sampleRate: number;
  onLevel: (rms: number) => void;
}

export class ScheduledPlayback {
  private ctx: AudioContext | null = null;
  private nextPlayTime = 0;
  private opts: PlaybackOptions;

  constructor(opts: PlaybackOptions) {
    this.opts = opts;
  }

  start(): void {
    const ctx = new AudioContext({ sampleRate: this.opts.sampleRate });
    this.ctx = ctx;
    this.nextPlayTime = ctx.currentTime;
    // Android AudioContext starts suspended; iOS starts running. Resume is
    // a no-op when already running, required on Android.
    ctx.resume?.();
  }

  // Decode base64 Int16 LE PCM and schedule it back-to-back on the Web
  // Audio context. nextPlayTime drives gapless playback: every new chunk
  // starts at max(nextPlayTime, now), and nextPlayTime advances by the
  // buffer's duration.
  enqueueBase64(b64: string): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const bytes = Buffer.from(b64, 'base64');
    if (bytes.length < 2) return;

    this.opts.onLevel(rmsInt16(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)));

    const frames = Math.floor(bytes.length / 2);
    const buffer = ctx.createBuffer(1, frames, this.opts.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      channel[i] = bytes.readInt16LE(i * 2) / 32768;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(this.nextPlayTime, ctx.currentTime);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
  }

  // Called on 'interruption' events. The residual buffered audio cannot be
  // pulled back from the native layer, so we just reset the pointer — new
  // audio scheduled after this will play immediately instead of after the
  // stale queue drains.
  flush(): void {
    if (this.ctx) this.nextPlayTime = this.ctx.currentTime;
    this.opts.onLevel(0);
  }

  stop(): void {
    this.ctx = null;
    this.nextPlayTime = 0;
    this.opts.onLevel(0);
  }
}
