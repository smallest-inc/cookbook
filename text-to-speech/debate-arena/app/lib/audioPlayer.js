/**
 * Streaming audio player: plays PCM chunks as they arrive via SSE.
 * One shared AudioContext for the whole debate, one player per speaker,
 * so two speakers can overlap (interruptions) and each face reads its own level.
 */

const SAMPLE_RATE = 44100;

/** Create the shared AudioContext. Call inside the Begin click so mobile Safari allows it. */
export function createAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx({ sampleRate: SAMPLE_RATE });
  // A one-sample silent buffer started inside the gesture unlocks output on iOS.
  const buf = ctx.createBuffer(1, 1, SAMPLE_RATE);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export class AudioStreamPlayer {
  constructor(ctx) {
    this.ctx = ctx;
    this.gainNode = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;
    this.gainNode.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    this._timeData = new Uint8Array(this.analyser.fftSize);
    this.reset();
  }

  /** Forget the previous turn and get ready for a new one. */
  reset() {
    this.sources = [];
    this.scheduledTime = 0;
    this.startedAt = null; // ctx time the first chunk of this turn starts
    this.streamDone = false; // all chunks of this turn have been scheduled
    this.isPlaying = false;
    this._endResolve = null;
    this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    this.gainNode.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  /** Schedule a PCM chunk (base64 16-bit mono) right after the previous one. */
  appendChunk(base64Audio) {
    if (this.ctx.state === "suspended") this.ctx.resume();
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = this.ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    const startTime = Math.max(this.scheduledTime, this.ctx.currentTime);
    if (this.startedAt === null) this.startedAt = startTime;
    source.start(startTime);
    this.scheduledTime = startTime + buffer.duration;
    this.sources.push(source);
    this.isPlaying = true;

    source.onended = () => {
      if (source === this.sources[this.sources.length - 1] && this.streamDone) this._finish();
    };
  }

  /** Mark that no more chunks are coming for this turn. */
  markStreamDone() {
    this.streamDone = true;
    if (!this.isPlaying || this.ctx.currentTime >= this.scheduledTime) this._finish();
  }

  _finish() {
    this.isPlaying = false;
    if (this._endResolve) {
      const r = this._endResolve;
      this._endResolve = null;
      r();
    }
  }

  /** Resolves when everything scheduled for this turn has played (or was cut off). */
  waitUntilDone() {
    if (!this.isPlaying) return Promise.resolve();
    if (this.streamDone && this.ctx.currentTime >= this.scheduledTime) {
      this._finish();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._endResolve = resolve;
    });
  }

  /** Seconds of this turn known so far, and how far playback has got. */
  progress() {
    if (this.startedAt === null) return { elapsed: 0, total: 0, done: false };
    const elapsed = Math.max(0, this.ctx.currentTime - this.startedAt);
    return { elapsed, total: this.scheduledTime - this.startedAt, done: this.streamDone };
  }

  /** Get cut off: fade out over `ms` and stop everything still scheduled. */
  cutOff(ms = 250) {
    const now = this.ctx.currentTime;
    const g = this.gainNode.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + ms / 1000);
    const stopAt = now + ms / 1000 + 0.02;
    for (const s of this.sources) {
      try {
        s.stop(stopAt);
      } catch {}
    }
    this.streamDone = true;
    this.scheduledTime = Math.min(this.scheduledTime, stopAt);
    setTimeout(() => this._finish(), ms + 30);
  }

  /** 0..1 loudness of what this player is outputting right now (for the mouth). */
  getLevel() {
    this.analyser.getByteTimeDomainData(this._timeData);
    let sum = 0;
    for (let i = 0; i < this._timeData.length; i++) {
      const v = (this._timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this._timeData.length) * 4);
  }

  getFrequencyData() {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  stop() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources = [];
    this.streamDone = true;
    this._finish();
  }
}

function sseHeaders(apiKeys) {
  const headers = { "Content-Type": "application/json" };
  if (apiKeys?.smallestKey) headers["x-smallest-key"] = apiKeys.smallestKey;
  return headers;
}

async function readSSE(res, onAudio) {
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS failed (${res.status}): ${err}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let payload;
      try {
        payload = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (payload.error) throw new Error(`TTS error: ${payload.error}`);
      if (payload.audio) onAudio(payload.audio);
    }
  }
}

/** Stream TTS and play each chunk as it arrives. Resolves when the stream has been fully scheduled. */
export async function streamToPlayer(text, voiceId, voiceParams, player, signal, apiKeys) {
  player.reset();
  const res = await fetch("/api/debate/speak-stream", {
    method: "POST",
    headers: sseHeaders(apiKeys),
    body: JSON.stringify({ text, voice_id: voiceId, ...voiceParams }),
    signal,
  });
  await readSSE(res, (a) => player.appendChunk(a));
  player.markStreamDone();
}

/** Fetch all TTS chunks without playing them, so the next speaker can start instantly. */
export async function bufferSpeech(text, voiceId, voiceParams, signal, apiKeys) {
  const res = await fetch("/api/debate/speak-stream", {
    method: "POST",
    headers: sseHeaders(apiKeys),
    body: JSON.stringify({ text, voice_id: voiceId, ...voiceParams }),
    signal,
  });
  const chunks = [];
  await readSSE(res, (a) => chunks.push(a));
  return chunks;
}

/** Play pre-buffered chunks on a player. Resolves once they are scheduled. */
export function playBuffered(chunks, player) {
  player.reset();
  for (const c of chunks) player.appendChunk(c);
  player.markStreamDone();
}
