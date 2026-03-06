/**
 * Streaming audio player — plays PCM chunks as they arrive via SSE.
 * Uses Web Audio API with AnalyserNode for waveform/lip-sync.
 */

const SAMPLE_RATE = 44100;

export class AudioStreamPlayer {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.gainNode = null;
    this.scheduledTime = 0;
    this.isPlaying = false;
    this._lastSource = null;
    this._endResolve = null;
  }

  _ensureContext() {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  /** Schedule a PCM chunk (base64) for gapless playback. */
  appendChunk(base64Audio) {
    this._ensureContext();
    this.isPlaying = true;

    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = this.ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    const startTime = Math.max(this.scheduledTime, this.ctx.currentTime);
    source.start(startTime);
    this.scheduledTime = startTime + buffer.duration;
    this._lastSource = source;

    source.onended = () => {
      if (this._lastSource === source && this._endResolve) {
        this.isPlaying = false;
        this._endResolve();
        this._endResolve = null;
      }
    };
  }

  /** Wait for all scheduled chunks to finish playing. */
  waitUntilDone() {
    if (!this.isPlaying || !this.ctx) return Promise.resolve();
    if (this.ctx.currentTime >= this.scheduledTime) {
      this.isPlaying = false;
      return Promise.resolve();
    }
    return new Promise((resolve) => { this._endResolve = resolve; });
  }

  /** Reset scheduling for a new speaker (reuse AudioContext). */
  reset() {
    this.scheduledTime = 0;
    this.isPlaying = false;
    this._lastSource = null;
    this._endResolve = null;
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Stop ALL audio immediately by closing the AudioContext. */
  stop() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.analyser = null;
      this.gainNode = null;
    }
    this._lastSource = null;
    this.scheduledTime = 0;
    this.isPlaying = false;
    if (this._endResolve) { this._endResolve(); this._endResolve = null; }
  }
}

/**
 * Stream TTS via SSE and play chunks in real-time as they arrive.
 * Audio starts playing from the FIRST chunk (~0.2-0.5s TTFB).
 * Returns a Promise that resolves when ALL audio finishes playing.
 */
export async function streamAndPlay(text, voiceId, voiceParams, player, signal, apiKeys) {
  const headers = { "Content-Type": "application/json" };
  if (apiKeys?.smallestKey) headers["x-smallest-key"] = apiKeys.smallestKey;

  const res = await fetch("/api/debate/speak-stream", {
    method: "POST",
    headers,
    body: JSON.stringify({ text, voice_id: voiceId, ...voiceParams }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS failed (${res.status}): ${err}`);
  }

  player.reset();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.error) throw new Error(`TTS error: ${payload.error}`);
        if (payload.done) break;
        if (payload.audio) {
          player.appendChunk(payload.audio); // Plays immediately!
        }
      } catch (e) {
        if (e.message.startsWith("TTS error")) throw e;
      }
    }
  }

  await player.waitUntilDone();
}

/**
 * Buffer TTS via SSE without playing. Returns array of base64 chunks.
 * Use this to pre-fetch the second speaker while the first plays.
 */
export async function bufferSpeech(text, voiceId, voiceParams, signal, apiKeys) {
  const headers = { "Content-Type": "application/json" };
  if (apiKeys?.smallestKey) headers["x-smallest-key"] = apiKeys.smallestKey;

  const res = await fetch("/api/debate/speak-stream", {
    method: "POST",
    headers,
    body: JSON.stringify({ text, voice_id: voiceId, ...voiceParams }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS failed (${res.status}): ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.done) break;
        if (payload.audio) chunks.push(payload.audio);
      } catch {}
    }
  }

  return chunks;
}
