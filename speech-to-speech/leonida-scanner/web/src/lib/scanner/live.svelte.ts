/**
 * Channel 6, the live channel. One Hydra speech-to-speech socket, opened straight from the browser
 * with a short-lived token the server minted (the real key never reaches this page).
 *
 * Own-key mode (server LIVE_MODE=byok): the visitor pastes their Smallest key, it is kept in this
 * tab's sessionStorage only, and the socket opens with it directly. It is never sent to our server.
 *
 * Protocol, from docs.smallest.ai (checked 20 Nov 2026):
 *   connect wss://api.smallest.ai/waves/v1/s2s?model=hydra-v1.1&api_key=<token>
 *   <- session.created      -> session.configure (once)      <- session.configured
 *   -> input_audio_buffer.append  (base64 PCM16, 16 kHz mono, 20 ms frames, continuous)
 *   <- input_audio_buffer.speech_started / speech_stopped
 *   <- response.created, response.output_audio.delta (PCM16 at the configured rate), response.done
 *   <- response.function_call_arguments.done -> conversation.item.create(function_call_output) + response.create
 * Barge-in is native: Hydra cancels the response (response.done status cancelled, reason interrupted)
 * and we drop whatever audio is still scheduled.
 *
 * Seen on the wire but not in the docs, so only used where losing it is harmless:
 *   response.output_audio_transcript.delta (captions), response.barge_in and turn_detection.state (ignored).
 *
 * Hydra takes audio in only. Text conversation items are accepted and ignored. So the "nudge" that
 * keeps the pilot talking is the studio on the radio: a short fixed Lightning clip streamed in as if
 * someone spoke it (see /api/desk).
 */
import { MicFramer, base64ToPcm, pcmToBase64, wavToPcm16, type RadioAudio } from './audio.js';
import { describeArgs, describeResult, pushCall, sessionClock, type ToolCallEntry } from './toolcalls.js';
import type { World } from './world.svelte.js';
import type { PlaceId, SkyTable } from './types.js';
import { Pilot } from './pilot.js';

export type LiveState = 'idle' | 'needkey' | 'minting' | 'connecting' | 'live' | 'offline' | 'busy' | 'ended' | 'error';

interface TokenResponse {
	access_token: string;
	expires_in: number;
	ws_url: string;
	output_rate: number;
	max_session_s: number;
	slot?: string;
	session: Record<string, unknown>;
}

export interface LiveHost {
	audio: () => RadioAudio | null;
	world: World;
	/** Sky Seven's airspace table from /api/channels (sky.py). */
	sky: () => SkyTable | null;
	/** Pilot speech state, for the radio's LED and captions. */
	onSpeaking(speaking: boolean): void;
	onUserSpeaking(speaking: boolean): void;
	onCaption(text: string): void;
	onHighlight(place: PlaceId): void;
	onLog(entry: { text: string; interrupted: boolean }): void;
	onDeskCue(text: string): void;
	onChange(): void;
}

const IDLE_MS = 4000;
const MIN_NUDGE_GAP_MS = 5000;
const IDLE_CUE_AFTER_MS = 8000;
const MAX_NUDGES = 20;
const MAX_MOVES_PER_RESPONSE = 3;
/** After a real tool call, the pilot's narration of it is not a second order. */
const TOOL_QUIET_MS = 8000;
const SILENCE = new Int16Array(320);
const KEY_STORE = 'leonida.smallestKey';

function readKey(): string {
	try {
		return sessionStorage.getItem(KEY_STORE) ?? '';
	} catch {
		return '';
	}
}

function writeKey(key: string): void {
	try {
		if (key) sessionStorage.setItem(KEY_STORE, key);
		else sessionStorage.removeItem(KEY_STORE);
	} catch {
		/* private mode: the key lives in memory for this page only */
	}
}

/** A pasted key, trimmed. Empty when it cannot be a key (spaces inside, far too short or long). */
export function cleanKey(raw: string): string {
	const key = raw.trim();
	return /^[A-Za-z0-9_\-.]{16,256}$/.test(key) ? key : '';
}

export class LiveSession {
	state = $state<LiveState>('idle');
	notice = $state('');
	muted = $state(false);
	speaking = $state(false);
	userSpeaking = $state(false);
	remaining = $state(0);
	nudges = $state(0);
	/** The server wants the visitor's own key for this channel. */
	byok = $state(false);
	hasKey = $state(false);

	private key = '';
	private ws: WebSocket | null = null;
	private slot: string | undefined;
	private outRate = 24000;
	private ready = false;
	private framer: MicFramer | null = null;
	private stopMic: (() => void) | null = null;
	private endTimer: ReturnType<typeof setTimeout> | null = null;
	private tick: ReturnType<typeof setInterval> | null = null;
	private createTimer: ReturnType<typeof setTimeout> | null = null;
	private drainTimer: ReturnType<typeof setTimeout> | null = null;
	private startedAt = 0;
	private maxSessionS = 300;
	private lastActive = 0;
	private lastNudge = 0;
	private idleN = 0;
	private injecting = false;
	private moves = 0;
	private toolPending = 0;
	private text = '';
	private queue: { unit: string; place: PlaceId }[] = [];
	private pilot: Pilot | null = null;
	private lastToolAt = -Infinity;
	private spoken = 0;
	/** what moved Sky Seven last, for the tests and the lab hooks: tool, or speech */
	lastOrder = $state<{ via: 'tool' | 'speech'; tool: string; ok: boolean; at: number } | null>(null);
	/** Orders that moved Sky Seven this session, newest first, for the tool-call panel. */
	calls = $state<ToolCallEntry[]>([]);
	private callSeq = 0;
	private seq = 0;
	private onHide = () => this.stop('');

	constructor(private host: LiveHost) {
		this.key = cleanKey(readKey());
		this.hasKey = !!this.key;
	}

	/** Keep the visitor's key for this tab. Returns false when it does not look like a key. */
	setKey(raw: string): boolean {
		const key = cleanKey(raw);
		if (!key) return false;
		this.key = key;
		this.hasKey = true;
		writeKey(key);
		return true;
	}

	forgetKey(): void {
		this.key = '';
		this.hasKey = false;
		writeKey('');
	}

	/** Own-key mode with no key yet: show the key field instead of calling. */
	private askKey(message = ''): void {
		this.byok = true;
		this.finish('needkey', message);
	}

	/** The tool runner, built once the airspace table has arrived. */
	getPilot(): Pilot | null {
		if (this.pilot) return this.pilot;
		const t = this.host.sky();
		if (!t) return null;
		this.pilot = new Pilot(t, { world: this.host.world, onHighlight: (p) => this.host.onHighlight(p) });
		return this.pilot;
	}

	get active(): boolean {
		return ['minting', 'connecting', 'live'].includes(this.state);
	}

	/** Called from the city clocks: something happened on another channel. */
	cue(unit: string, place: PlaceId): void {
		if (!this.active) return;
		if (this.queue.length < 3) this.queue.push({ unit, place });
	}

	async start(): Promise<void> {
		if (this.active) return;
		if (this.byok) return this.startOwnKey();
		this.notice = '';
		this.state = 'minting';
		this.host.onChange();
		let tok: TokenResponse;
		try {
			const res = await fetch('/api/live/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			});
			const data = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string };
			if (res.status === 403) return this.askKey();
			if (res.status === 503) return this.finish('offline', 'Channel 6 is offline. This server has no Smallest key set yet.');
			if (res.status === 429) return this.finish('busy', data.error ? `${data.error.charAt(0).toUpperCase()}${data.error.slice(1)}.` : 'Channel 6 is full right now. Try again in a minute.');
			if (!res.ok) return this.finish('error', data.error ? `Channel 6: ${data.error}` : `Channel 6 failed (${res.status}).`);
			tok = data;
		} catch {
			return this.finish('error', 'Could not reach the server for a live token.');
		}
		this.slot = tok.slot;
		this.maxSessionS = tok.max_session_s || 300;
		this.outRate = tok.output_rate || 24000;
		this.state = 'connecting';
		this.host.onChange();
		this.open(tok);
	}

	private async startOwnKey(): Promise<void> {
		if (!this.key) return this.askKey();
		this.notice = '';
		this.state = 'minting';
		this.host.onChange();
		let cfg: Omit<TokenResponse, 'access_token' | 'expires_in'>;
		try {
			const res = await fetch('/api/live/session');
			if (!res.ok) return this.finish('error', `Channel 6 failed (${res.status}).`);
			cfg = await res.json();
		} catch {
			return this.finish('error', 'Could not reach the server for the channel setup.');
		}
		if (this.state !== 'minting' || !this.key) return;
		this.slot = undefined;
		this.maxSessionS = cfg.max_session_s || 300;
		this.outRate = cfg.output_rate || 24000;
		this.state = 'connecting';
		this.host.onChange();
		this.open({ ...cfg, access_token: this.key, expires_in: 0 });
	}

	private open(tok: TokenResponse): void {
		const audio = this.host.audio();
		if (!audio) return this.finish('error', 'The radio is off.');
		let ws: WebSocket;
		try {
			ws = new WebSocket(`${tok.ws_url}&api_key=${encodeURIComponent(tok.access_token)}`);
		} catch {
			return this.finish('error', 'Could not open the live socket.');
		}
		this.ws = ws;
		const mine = ++this.seq;
		let opened = false;
		ws.onopen = () => (opened = true);
		ws.onmessage = (ev) => {
			if (mine !== this.seq) return;
			try {
				this.onEvent(JSON.parse(String(ev.data)), tok);
			} catch {
				/* a malformed frame is not worth ending the call */
			}
		};
		ws.onerror = () => {
			/* the close handler decides what to tell the user */
		};
		ws.onclose = (ev) => {
			if (mine !== this.seq) return;
			if (ev.code === 1013)
				this.finish(
					'busy',
					this.byok
						? 'Your Smallest account has too many live sessions open. Close one and tune in again.'
						: 'Channel 6 is full right now. Try again in a minute.'
				);
			else if (!opened && this.byok) {
				// A refused key and a dropped network look the same from here (the 401 is not exposed).
				this.forgetKey();
				this.askKey('Smallest did not accept that key, or the network dropped. Check the key and paste it again.');
			} else if (!opened) this.finish('error', 'Could not connect to the live channel. Check the network and tune in again.');
			else if (this.state === 'live') this.finish('ended', 'The live channel hung up. Tune away and back to call again.');
		};
		window.addEventListener('pagehide', this.onHide);
	}

	private send(obj: Record<string, unknown>): void {
		if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
	}

	private sendAudio(pcm: Int16Array): void {
		this.send({ type: 'input_audio_buffer.append', audio: pcmToBase64(pcm) });
	}

	private onEvent(evt: Record<string, any>, tok: TokenResponse): void {
		const audio = this.host.audio();
		switch (evt.type) {
			case 'session.created':
				// The handshake is one-shot: exactly one session.configure, right now.
				this.send({ type: 'session.configure', session: tok.session });
				break;
			case 'session.configured': {
				const rate = Number(evt.session?.output_audio_sample_rate);
				if (rate) this.outRate = rate;
				this.beginCall();
				break;
			}
			case 'input_audio_buffer.speech_started':
				// Barge-in: stop local playback at once. Hydra cancels its response on its own side.
				audio?.livePlayer().cut();
				if (this.speaking) this.setSpeaking(false, true);
				if (!this.injecting) {
					this.userSpeaking = true;
					this.host.onUserSpeaking(true);
				}
				break;
			case 'input_audio_buffer.speech_stopped':
				if (this.userSpeaking) {
					this.userSpeaking = false;
					this.host.onUserSpeaking(false);
				}
				this.lastActive = performance.now();
				break;
			case 'response.created':
				audio?.livePlayer().reset();
				this.text = '';
				this.spoken = 0;
				this.moves = 0;
				this.host.onCaption('');
				this.setSpeaking(true);
				break;
			case 'response.output_audio.delta':
				if (typeof evt.delta === 'string') audio?.livePlayer().push(base64ToPcm(evt.delta), this.outRate);
				break;
			case 'response.output_audio_transcript.delta':
				if (typeof evt.delta === 'string') {
					this.text += evt.delta;
					this.host.onCaption(this.text.trim());
					// at each clause break, check whether he said he is going somewhere a tool did not cover
					if (/[,.!?;]/.test(evt.delta)) this.speechOrder();
				}
				break;
			case 'response.function_call_arguments.done':
				this.runTool(String(evt.name ?? ''), String(evt.call_id ?? ''), String(evt.arguments ?? '{}'));
				break;
			case 'response.done': {
				const status = String(evt.response?.status ?? 'completed');
				const interrupted = status === 'cancelled';
				if (!interrupted) this.speechOrder();
				if (this.text.trim() && !this.toolPending) this.host.onLog({ text: this.text.trim(), interrupted });
				if (interrupted) this.setSpeaking(false, true);
				else this.drain();
				break;
			}
			case 'error': {
				const code = String(evt.error?.code ?? '');
				if (code === 'server_full') this.finish('busy', 'Channel 6 is full right now. Try again in a minute.');
				else if (code !== 'tool_response_timeout') this.notice = `Live channel: ${evt.error?.message ?? code}`.slice(0, 160);
				this.host.onChange();
				break;
			}
			default:
				break; // turn_detection.state, response.barge_in, conversation.item.* and the rest
		}
	}

	private logCall(via: 'tool' | 'speech', name: string, args: string, result: Record<string, unknown>): void {
		this.calls = pushCall(this.calls, {
			id: ++this.callSeq,
			via,
			name: name || '?',
			args,
			result: describeResult(result),
			ok: Boolean(result.ok),
			clock: sessionClock(performance.now() - this.startedAt)
		});
	}

	private beginCall(): void {
		const audio = this.host.audio();
		if (!audio) return;
		this.calls = [];
		this.ready = true;
		this.state = 'live';
		this.startedAt = performance.now();
		this.lastActive = this.startedAt;
		this.framer = new MicFramer(audio.sampleRate);
		if (audio.micReady) {
			this.stopMic = audio.listenMic((chunk) => {
				if (!this.ready || !this.framer) return;
				const frames = this.framer.push(chunk);
				// While a desk cue is streaming in, the mic stays out of the way.
				if (this.injecting) return;
				for (const f of frames) this.sendAudio(this.muted ? SILENCE : f);
			});
		} else {
			// No mic: keep the socket warm with silence, the docs count it as traffic.
			this.stopMic = null;
			const iv = setInterval(() => !this.injecting && this.sendAudio(SILENCE), 20);
			this.stopMic = () => clearInterval(iv);
		}
		this.remaining = this.maxSessionS;
		this.endTimer = setTimeout(
			() => this.finish('ended', 'Five minutes are up. Tune away and back to start another.'),
			this.maxSessionS * 1000
		);
		this.tick = setInterval(() => {
			this.remaining = Math.max(0, Math.round(this.maxSessionS - (performance.now() - this.startedAt) / 1000));
			this.maybeNudge();
		}, 500);
		this.host.onChange();
	}

	setMuted(v: boolean): void {
		this.muted = v;
		this.host.onChange();
	}

	toggleMute(): void {
		this.setMuted(!this.muted);
	}

	// ------------------------------------------------------------ tools
	private runTool(name: string, callId: string, raw: string): void {
		let result: Record<string, unknown> = { ok: false, error: 'bad arguments' };
		let args: unknown = raw;
		try {
			args = JSON.parse(raw || '{}') as Record<string, unknown>;
			const pilot = this.getPilot();
			if (!pilot) result = { ok: false, error: 'map not loaded yet' };
			else if (this.moves >= MAX_MOVES_PER_RESPONSE) result = { ok: false, error: 'one order at a time' };
			else {
				this.moves += 1;
				result = pilot.run(name, args);
				this.lastToolAt = performance.now();
				this.lastOrder = { via: 'tool', tool: name, ok: Boolean(result.ok), at: this.lastToolAt };
			}
		} catch {
			/* keep the bad-arguments result */
		}
		this.logCall('tool', name, describeArgs(args), result);
		this.toolPending += 1;
		this.send({
			type: 'conversation.item.create',
			item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) }
		});
		// One response.create per turn, 200 ms after the last tool output (multi-tool turns).
		if (this.createTimer) clearTimeout(this.createTimer);
		this.createTimer = setTimeout(() => {
			this.toolPending = 0;
			this.send({ type: 'response.create' });
		}, 200);
	}

	/**
	 * The pilot's words as an order, for a turn where he says "heading to Coquina Row" and no tool
	 * fired. Never right after a real tool call (that is him narrating it), at most one per response.
	 */
	private speechOrder(): void {
		if (this.spoken || this.toolPending || performance.now() - this.lastToolAt < TOOL_QUIET_MS) return;
		const pilot = this.getPilot();
		if (!pilot) return;
		const done = pilot.fromSpeech(this.text);
		if (done) {
			this.spoken += 1;
			this.lastOrder = { via: 'speech', tool: done.tool, ok: true, at: performance.now() };
			this.logCall('speech', done.tool, describeArgs({ target: done.target }), { ok: true, from: 'his words, no tool call' });
		}
	}

	// ------------------------------------------------------------ speaking state
	private setSpeaking(v: boolean, interrupted = false): void {
		if (this.drainTimer) clearTimeout(this.drainTimer);
		this.drainTimer = null;
		if (this.speaking === v) return;
		this.speaking = v;
		const audio = this.host.audio();
		if (v) audio?.squelchOpen(false);
		else {
			audio?.squelchTail();
			this.lastActive = performance.now();
			if (interrupted) this.host.onCaption('');
		}
		this.host.onSpeaking(v);
	}

	/** The server finished the response. The audio may still be playing for a moment. */
	private drain(): void {
		const left = this.host.audio()?.livePlayer().queued ?? 0;
		if (this.drainTimer) clearTimeout(this.drainTimer);
		this.drainTimer = setTimeout(() => this.setSpeaking(false), Math.max(0, left * 1000) + 60);
	}

	// ------------------------------------------------------------ nudges
	private maybeNudge(): void {
		if (this.state !== 'live') return;
		const now = performance.now();
		if (this.speaking || this.userSpeaking || this.injecting || this.toolPending) {
			this.lastActive = now;
			return;
		}
		if (now - this.lastActive < IDLE_MS || now - this.lastNudge < MIN_NUDGE_GAP_MS) return;
		if (this.nudges >= MAX_NUDGES) return;
		const ev = this.queue.shift();
		if (ev) void this.inject(`k=at&u=${encodeURIComponent(ev.unit)}&p=${encodeURIComponent(ev.place)}`);
		else if (now - this.lastActive >= IDLE_CUE_AFTER_MS) void this.inject(`k=idle&v=${this.idleN++}`);
	}

	private async inject(query: string): Promise<void> {
		const audio = this.host.audio();
		if (!audio || this.injecting) return;
		this.injecting = true;
		this.lastNudge = performance.now();
		this.nudges += 1;
		try {
			const res = await fetch(`/api/desk?${query}`);
			if (!res.ok) throw new Error('desk');
			const bytes = await res.arrayBuffer();
			const pcm = wavToPcm16(bytes);
			if (!pcm.length || this.state !== 'live') return;
			// The studio is heard on the radio too, then streamed to Hydra as a spoken turn.
			const buf = await audio.decode(bytes);
			audio.squelchOpen(false);
			const playing = audio.play(buf, 0);
			void playing.ended.then(() => audio.squelchTail());
			this.host.onDeskCue(query);
			for (let i = 0; i < pcm.length && this.state === 'live'; i += 320) {
				const frame = new Int16Array(320);
				frame.set(pcm.subarray(i, i + 320));
				this.sendAudio(frame);
				await new Promise((r) => setTimeout(r, 20));
			}
			// 0.8 s of silence so turn detection closes the cue.
			for (let i = 0; i < 40 && this.state === 'live'; i += 1) {
				this.sendAudio(SILENCE);
				await new Promise((r) => setTimeout(r, 20));
			}
		} catch {
			/* the desk is optional, the pilot keeps flying */
		} finally {
			this.injecting = false;
			this.lastActive = performance.now();
		}
	}

	// ------------------------------------------------------------ end
	stop(message = ''): void {
		this.finish('idle', message);
	}

	private finish(state: LiveState, message: string): void {
		this.seq += 1; // ignore anything the old socket still says
		window.removeEventListener('pagehide', this.onHide);
		if (this.endTimer) clearTimeout(this.endTimer);
		if (this.tick) clearInterval(this.tick);
		if (this.createTimer) clearTimeout(this.createTimer);
		if (this.drainTimer) clearTimeout(this.drainTimer);
		this.endTimer = this.tick = this.createTimer = this.drainTimer = null;
		this.stopMic?.();
		this.stopMic = null;
		this.ready = false;
		this.framer = null;
		this.injecting = false;
		this.toolPending = 0;
		this.queue = [];
		this.host.audio()?.livePlayer().cut();
		const ws = this.ws;
		this.ws = null;
		if (ws) {
			try {
				ws.close(1000);
			} catch {
				/* closed already */
			}
		}
		if (this.slot) {
			void fetch('/api/live/end', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slot: this.slot }),
				keepalive: true
			}).catch(() => {});
			this.slot = undefined;
		}
		const wasSpeaking = this.speaking;
		this.speaking = false;
		if (this.userSpeaking) this.host.onUserSpeaking(false);
		this.userSpeaking = false;
		this.remaining = 0;
		this.state = state;
		this.notice = message;
		if (wasSpeaking) this.host.onSpeaking(false);
		this.host.onChange();
	}
}
