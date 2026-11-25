/**
 * The radio's sound. Everything here is synthesized in the browser from the real
 * Lightning clips: band-pass voice chain, light distortion, squelch, static and clicks.
 * Levels come from AnalyserNodes on the real audio, never from a timer.
 */

function makeNoise(ctx: AudioContext, seconds = 2): AudioBuffer {
	const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
	return buf;
}

function rms(analyser: AnalyserNode, scratch: Float32Array<ArrayBuffer>): number {
	analyser.getFloatTimeDomainData(scratch);
	let sum = 0;
	for (let i = 0; i < scratch.length; i += 1) sum += scratch[i] * scratch[i];
	return Math.sqrt(sum / scratch.length);
}

export interface Playing {
	stop(): void;
	ended: Promise<'ended' | 'stopped'>;
}

export class RadioAudio {
	readonly ctx: AudioContext;
	private voiceIn: GainNode;
	private master: GainNode;
	private carrier: GainNode;
	private noise: AudioBuffer;
	private rxAnalyser: AnalyserNode;
	private micAnalyser: AnalyserNode | null = null;
	private scratch: Float32Array<ArrayBuffer>;
	private micStream: MediaStream | null = null;
	private capture: AudioWorkletNode | null = null;
	private chunks: Float32Array[] = [];
	private capturing = false;
	private micListeners = new Set<(chunk: Float32Array) => void>();
	/** Live channel playback and its level, wired into the same radio voice chain. */
	live: LivePlayer | null = null;

	constructor() {
		this.ctx = new AudioContext({ latencyHint: 'interactive' });
		const ctx = this.ctx;
		this.noise = makeNoise(ctx);
		this.scratch = new Float32Array(1024);

		this.master = ctx.createGain();
		this.master.gain.value = 0.7;
		this.master.connect(ctx.destination);

		// voice chain: small speaker, narrow band, a little grit
		this.voiceIn = ctx.createGain();
		const hp = ctx.createBiquadFilter();
		hp.type = 'highpass';
		hp.frequency.value = 340;
		hp.Q.value = 0.8;
		const presence = ctx.createBiquadFilter();
		presence.type = 'peaking';
		presence.frequency.value = 1900;
		presence.gain.value = 5;
		presence.Q.value = 0.9;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 3100;
		lp.Q.value = 0.9;
		const shaper = ctx.createWaveShaper();
		const curve = new Float32Array(512);
		for (let i = 0; i < curve.length; i += 1) {
			const x = (i * 2) / (curve.length - 1) - 1;
			curve[i] = Math.tanh(x * 2.4) / Math.tanh(2.4);
		}
		shaper.curve = curve;
		shaper.oversample = '2x';
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -26;
		comp.knee.value = 10;
		comp.ratio.value = 6;
		comp.attack.value = 0.003;
		comp.release.value = 0.15;
		const makeup = ctx.createGain();
		makeup.gain.value = 1.25;
		this.voiceIn.connect(hp).connect(presence).connect(lp).connect(shaper).connect(comp).connect(makeup);
		this.rxAnalyser = ctx.createAnalyser();
		this.rxAnalyser.fftSize = 1024;
		makeup.connect(this.rxAnalyser);
		makeup.connect(this.master);

		// open-carrier hiss: only audible while a transmission is on the air
		const bed = ctx.createBufferSource();
		bed.buffer = this.noise;
		bed.loop = true;
		const bedFilter = ctx.createBiquadFilter();
		bedFilter.type = 'bandpass';
		bedFilter.frequency.value = 2200;
		bedFilter.Q.value = 0.5;
		this.carrier = ctx.createGain();
		this.carrier.gain.value = 0;
		bed.connect(bedFilter).connect(this.carrier).connect(this.master);
		bed.start();
	}

	async resume(): Promise<void> {
		if (this.ctx.state === 'suspended') await this.ctx.resume();
	}

	set volume(v: number) {
		this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 1.1, this.ctx.currentTime, 0.03);
	}

	async decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
		return this.ctx.decodeAudioData(bytes.slice(0));
	}

	private burst(opts: { gain: number; dur: number; freq: number; q?: number; sweepTo?: number; at?: number }) {
		const ctx = this.ctx;
		const t = opts.at ?? ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const f = ctx.createBiquadFilter();
		f.type = 'bandpass';
		f.frequency.setValueAtTime(opts.freq, t);
		if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
		f.Q.value = opts.q ?? 0.7;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(opts.gain, t + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
		src.connect(f).connect(g).connect(this.master);
		src.start(t, Math.random());
		src.stop(t + opts.dur + 0.05);
	}

	private tone(freq: number, dur: number, gain: number, at?: number, type: OscillatorType = 'sine') {
		const ctx = this.ctx;
		const t = at ?? ctx.currentTime;
		const osc = ctx.createOscillator();
		osc.type = type;
		osc.frequency.value = freq;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(gain, t + 0.006);
		g.gain.setValueAtTime(gain, t + dur - 0.01);
		g.gain.linearRampToValueAtTime(0.0001, t + dur);
		osc.connect(g).connect(this.master);
		osc.start(t);
		osc.stop(t + dur + 0.02);
	}

	/** Detent click of a knob. */
	click() {
		this.burst({ gain: 0.18, dur: 0.018, freq: 4200, q: 1.4 });
		this.tone(2400, 0.012, 0.02, undefined, 'square');
	}

	/** Static sweep while the receiver retunes. */
	sweep() {
		this.burst({ gain: 0.11, dur: 0.24, freq: 900, sweepTo: 3600, q: 0.9 });
	}

	/** Squelch opening at the start of a transmission. */
	squelchOpen(joinedMid: boolean) {
		this.burst({ gain: joinedMid ? 0.08 : 0.16, dur: joinedMid ? 0.08 : 0.12, freq: 1800, q: 0.6 });
		this.carrier.gain.setTargetAtTime(0.014, this.ctx.currentTime, 0.02);
	}

	/** End of a transmission: short roger tone and the squelch tail. */
	squelchTail() {
		const t = this.ctx.currentTime;
		this.tone(1250, 0.07, 0.025, t);
		this.burst({ gain: 0.2, dur: 0.24, freq: 2000, q: 0.5, at: t + 0.07 });
		this.carrier.gain.setTargetAtTime(0, t + 0.08, 0.03);
	}

	/** Cut the carrier hiss right away (channel change, key-down). */
	hush() {
		this.carrier.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
	}

	/** Your key-down: two-tone chirp. */
	keyDown() {
		const t = this.ctx.currentTime;
		this.tone(1450, 0.045, 0.03, t);
		this.tone(1900, 0.05, 0.03, t + 0.05);
		this.carrier.gain.setTargetAtTime(0, t, 0.01);
	}

	/** Your key-up: squelch crash. */
	keyUp() {
		this.burst({ gain: 0.22, dur: 0.2, freq: 1700, q: 0.5 });
	}

	play(buffer: AudioBuffer, offset = 0): Playing {
		const src = this.ctx.createBufferSource();
		src.buffer = buffer;
		const g = this.ctx.createGain();
		g.gain.value = 1;
		src.connect(g).connect(this.voiceIn);
		let stopped = false;
		const ended = new Promise<'ended' | 'stopped'>((resolve) => {
			src.onended = () => resolve(stopped ? 'stopped' : 'ended');
		});
		src.start(this.ctx.currentTime + 0.02, Math.max(0, Math.min(offset, buffer.duration - 0.05)));
		return {
			stop: () => {
				if (stopped) return;
				stopped = true;
				const t = this.ctx.currentTime;
				g.gain.setTargetAtTime(0, t, 0.01);
				try {
					src.stop(t + 0.05);
				} catch {
					/* already stopped */
				}
			},
			ended
		};
	}

	rxLevel(): number {
		return Math.min(1, rms(this.rxAnalyser, this.scratch) * 4.5);
	}

	micLevel(): number {
		if (!this.micAnalyser) return 0;
		return Math.min(1, rms(this.micAnalyser, this.scratch) * 7);
	}

	/** Stream the open mic to a listener (channel 6). Returns a function that stops listening. */
	listenMic(fn: (chunk: Float32Array) => void): () => void {
		this.micListeners.add(fn);
		return () => this.micListeners.delete(fn);
	}

	/** Output of the live pilot goes through the same radio filter as the scripted voices. */
	livePlayer(): LivePlayer {
		this.live ??= new LivePlayer(this.ctx, this.voiceIn);
		return this.live;
	}

	/** Sample rate of the mic stream the worklet delivers. */
	get sampleRate(): number {
		return this.ctx.sampleRate;
	}

	get micReady(): boolean {
		return this.capture !== null;
	}

	async openMic(): Promise<void> {
		this.micStream = await navigator.mediaDevices.getUserMedia({
			audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
		});
		await this.ctx.audioWorklet.addModule('/recorder-worklet.js');
		const src = this.ctx.createMediaStreamSource(this.micStream);
		this.micAnalyser = this.ctx.createAnalyser();
		this.micAnalyser.fftSize = 1024;
		src.connect(this.micAnalyser);
		this.capture = new AudioWorkletNode(this.ctx, 'capture');
		this.capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
			if (this.capturing) this.chunks.push(event.data);
			for (const fn of this.micListeners) fn(event.data);
		};
		const sink = this.ctx.createGain();
		sink.gain.value = 0;
		src.connect(this.capture).connect(sink).connect(this.ctx.destination);
	}

	startCapture() {
		this.chunks = [];
		this.capturing = true;
	}

	/** Stops capture and returns { wav, seconds }. 16 kHz mono PCM, what Pulse wants. */
	stopCapture(): { wav: ArrayBuffer; seconds: number } {
		this.capturing = false;
		const total = this.chunks.reduce((n, c) => n + c.length, 0);
		const merged = new Float32Array(total);
		let o = 0;
		for (const c of this.chunks) {
			merged.set(c, o);
			o += c.length;
		}
		this.chunks = [];
		const rate = this.ctx.sampleRate;
		const pcm = downsample(merged, rate, 16000);
		return { wav: encodeWav(pcm, 16000), seconds: total / rate };
	}

	close() {
		this.micStream?.getTracks().forEach((t) => t.stop());
		void this.ctx.close();
	}
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
	if (from === to) return input;
	const ratio = from / to;
	const out = new Float32Array(Math.floor(input.length / ratio));
	for (let i = 0; i < out.length; i += 1) {
		// average the window so we do not alias
		const a = Math.floor(i * ratio);
		const b = Math.min(input.length, Math.floor((i + 1) * ratio));
		let s = 0;
		for (let j = a; j < b; j += 1) s += input[j];
		out[i] = b > a ? s / (b - a) : 0;
	}
	return out;
}

function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
	const buf = new ArrayBuffer(44 + samples.length * 2);
	const v = new DataView(buf);
	const str = (o: number, s: string) => {
		for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i));
	};
	str(0, 'RIFF');
	v.setUint32(4, 36 + samples.length * 2, true);
	str(8, 'WAVE');
	str(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	str(36, 'data');
	v.setUint32(40, samples.length * 2, true);
	let o = 44;
	for (let i = 0; i < samples.length; i += 1) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
		o += 2;
	}
	return buf;
}

/**
 * Gapless playback of PCM16 chunks from Hydra, with an instant cut for barge-in.
 * Chunks are scheduled one after another on a cursor. cut() fades the current response out
 * and starts a fresh gain, so nothing already scheduled keeps playing (the Hydra docs warn
 * that scheduled chunks play on unless dropped).
 */
export class LivePlayer {
	private gain: GainNode;
	private cursor = 0;
	private sources = new Set<AudioBufferSourceNode>();

	constructor(
		private ctx: AudioContext,
		private out: AudioNode
	) {
		this.gain = ctx.createGain();
		this.gain.connect(out);
	}

	/** Seconds of audio still scheduled. */
	get queued(): number {
		return Math.max(0, this.cursor - this.ctx.currentTime);
	}

	get playing(): boolean {
		return this.sources.size > 0 && this.queued > 0.02;
	}

	/** A new response starts: drop whatever the last one left scheduled. */
	reset(): void {
		this.cut();
	}

	push(pcm: Int16Array, rate: number): void {
		if (!pcm.length) return;
		const buf = this.ctx.createBuffer(1, pcm.length, rate);
		const ch = buf.getChannelData(0);
		for (let i = 0; i < pcm.length; i += 1) ch[i] = pcm[i] / 0x8000;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		src.connect(this.gain);
		const start = Math.max(this.ctx.currentTime + 0.03, this.cursor);
		src.start(start);
		this.cursor = start + buf.duration;
		this.sources.add(src);
		src.onended = () => this.sources.delete(src);
	}

	/** Stop everything scheduled, right now. */
	cut(): void {
		const t = this.ctx.currentTime;
		const old = this.gain;
		old.gain.cancelScheduledValues(t);
		old.gain.setTargetAtTime(0, t, 0.008);
		for (const src of this.sources) {
			try {
				src.stop(t + 0.05);
			} catch {
				/* already stopped */
			}
		}
		this.sources.clear();
		setTimeout(() => old.disconnect(), 120);
		this.gain = this.ctx.createGain();
		this.gain.connect(this.out);
		this.cursor = 0;
	}
}

/** Streaming resampler: mic float32 at any rate in, PCM16 frames of 20 ms at 16 kHz out. */
export class MicFramer {
	private buf = new Float32Array(0);
	private pos = 0;
	constructor(private inRate: number) {}

	/** Pushes samples, returns zero or more 320-sample (20 ms) PCM16 frames. */
	push(chunk: Float32Array): Int16Array[] {
		const merged = new Float32Array(this.buf.length + chunk.length);
		merged.set(this.buf, 0);
		merged.set(chunk, this.buf.length);
		this.buf = merged;
		const ratio = this.inRate / 16000;
		const frames: Int16Array[] = [];
		while (this.pos + ratio * 320 + 1 <= this.buf.length) {
			const out = new Int16Array(320);
			for (let i = 0; i < 320; i += 1) {
				const a = this.pos + i * ratio;
				const b = a + ratio;
				const ia = Math.floor(a);
				const ib = Math.min(this.buf.length, Math.ceil(b));
				let sum = 0;
				for (let j = ia; j < ib; j += 1) sum += this.buf[j];
				const v = ib > ia ? sum / (ib - ia) : 0;
				const c = Math.max(-1, Math.min(1, v));
				out[i] = c < 0 ? c * 0x8000 : c * 0x7fff;
			}
			frames.push(out);
			this.pos += ratio * 320;
		}
		const drop = Math.floor(this.pos);
		if (drop > 0) {
			this.buf = this.buf.slice(drop);
			this.pos -= drop;
		}
		return frames;
	}
}

export function pcmToBase64(pcm: Int16Array): string {
	const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}

export function base64ToPcm(b64: string): Int16Array {
	const bin = atob(b64);
	const out = new Int16Array(Math.floor(bin.length / 2));
	for (let i = 0; i < out.length; i += 1) {
		const v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
		out[i] = v > 0x7fff ? v - 0x10000 : v;
	}
	return out;
}

/** Decode a 16 kHz mono PCM16 wav (the desk cues) to raw samples. */
export function wavToPcm16(bytes: ArrayBuffer): Int16Array {
	const view = new DataView(bytes);
	let off = 12;
	while (off + 8 <= view.byteLength) {
		const id = String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
		const size = view.getUint32(off + 4, true);
		if (id === 'data') {
			const n = Math.floor(Math.min(size, view.byteLength - off - 8) / 2);
			const out = new Int16Array(n);
			for (let i = 0; i < n; i += 1) out[i] = view.getInt16(off + 8 + i * 2, true);
			return out;
		}
		off += 8 + size + (size % 2);
	}
	return new Int16Array(0);
}
