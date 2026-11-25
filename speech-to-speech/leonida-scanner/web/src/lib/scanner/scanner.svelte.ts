/**
 * The scanner: five channels that keep talking whether or not you are tuned in.
 *
 * Each channel is a loop of real Lightning clips on its own clock. Tuning in computes
 * where that channel is "right now" and joins mid-sentence if someone is talking,
 * exactly like a real scanner. Push-to-talk freezes the channel, sends your clip to
 * Pulse, asks Electron for an in-character reply, voices it with Lightning, and plays
 * it on that channel. Then the loop resumes where it left off.
 *
 * v3 adds channel 6, a live Hydra voice (see live.svelte.ts), and a shared world of moving units
 * (world.svelte.ts) that the map and the 3D view both draw.
 */
import * as api from './api.js';
import { RadioAudio, type Playing } from './audio.js';
import { LiveSession } from './live.svelte.js';
import { World, type Action, type UnitInfo, type UnitKind } from './world.svelte.js';
import type {
	Beats,
	Channel,
	ChannelsPayload,
	LogEntry,
	Marker,
	Phase,
	Place,
	PlaceId,
	ReplyCall,
	Scene,
	SkyTable,
	Timings,
	Transmission
} from './types.js';

const MAX_TX_S = 20;
const MIN_TX_S = 0.5;
// Where each channel's loop is when you switch the radio on, as a fraction of the loop.
// Channel 1 starts a moment before the marina call so the first thing you hear is the hook.
const START_AT = [-1, 0.42, 0.63, 0.2, 0.81];

interface Pending {
	call: ReplyCall;
	label: string;
	buffer: AudioBuffer;
}

function clockNow(): string {
	return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export class Scanner {
	phase = $state<Phase>('off');
	channels = $state<Channel[]>([]);
	places = $state<Record<PlaceId, Place>>({});
	playerPlace = $state<PlaceId>('banyan_park');
	tuned = $state(0);
	volume = $state(0.7);
	current = $state<Transmission | null>(null);
	lastPlace = $state<PlaceId | null>(null);
	level = $state(0);
	loaded = $state<Record<string, number>>({});
	log = $state<LogEntry[]>([]);
	unitPos = $state<Record<string, Record<string, PlaceId>>>({});
	message = $state('');
	errorText = $state('');
	micOk = $state(false);
	txStartedAt = $state(0);
	workStartedAt = $state(0);
	workStep = $state('');
	heard = $state('');
	timings = $state<Timings | null>(null);
	pendingCount = $state<Record<string, number>>({});
	liveAvailable = $state(true);
	liveHighlightAt = $state(0);

	readonly world = new World();
	readonly live = new LiveSession({
		audio: () => this.audio,
		world: this.world,
		sky: () => this.skyTable,
		onSpeaking: (v) => this.onLiveSpeaking(v),
		onUserSpeaking: (v) => this.onLiveUserSpeaking(v),
		onCaption: (text) => this.onLiveCaption(text),
		onHighlight: (place) => this.onLiveHighlight(place),
		onLog: (e) => this.onLiveLog(e),
		onDeskCue: (q) => this.onDeskCue(q),
		onChange: () => {}
	});

	private beats: Beats = { speakers: {}, jet: {}, person: {} };
	private skyTable: SkyTable | null = null;
	private livePlace: PlaceId | null = null;
	private liveTimer: ReturnType<typeof setTimeout> | null = null;
	private clockTimer: ReturnType<typeof setInterval> | null = null;
	private clockSeen: Record<string, number> = {};
	private audio: RadioAudio | null = null;
	private buffers = new Map<string, AudioBuffer>();
	private epochs: Record<string, number> = {};
	private frozenAt: Record<string, number | null> = {};
	private pending: Record<string, Pending[]> = {};
	private poweredAt = 0;
	private playing: Playing | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private txTimer: ReturnType<typeof setTimeout> | null = null;
	private raf = 0;
	private token = 0;
	private logId = 0;
	private loading = new Map<string, Promise<void>>();

	get channel(): Channel | null {
		return this.channels[this.tuned] ?? null;
	}

	get loadedCount(): number {
		const ch = this.channel;
		return ch ? (this.loaded[ch.id] ?? 0) : 0;
	}

	// ------------------------------------------------------------ power
	async powerOn(): Promise<void> {
		if (this.phase !== 'off' && this.phase !== 'error') return;
		this.errorText = '';
		this.message = '';
		this.phase = 'booting';
		try {
			this.audio ??= new RadioAudio();
			await this.audio.resume();
			this.audio.volume = this.volume;
			this.audio.click();
			if (!this.channels.length) {
				const data: ChannelsPayload = await api.getChannels();
				this.channels = data.channels;
				this.places = data.places;
				this.playerPlace = data.player.place;
				this.beats = data.beats;
				this.skyTable = data.sky ?? null;
				this.world.init(
					Object.fromEntries(
						Object.entries(data.units).map(([id, u]) => [id, { ...u, kind: u.kind as UnitKind } as UnitInfo])
					),
					data.places
				);
				for (const ch of data.channels) {
					this.unitPos[ch.id] = Object.fromEntries(
						Object.entries(ch.speakers).map(([id, sp]) => [id, sp.home])
					);
					this.pending[ch.id] = [];
					this.pendingCount[ch.id] = 0;
					this.frozenAt[ch.id] = null;
				}
			}
			try {
				if (!this.audio.micReady) await this.audio.openMic();
				this.micOk = true;
			} catch {
				this.micOk = false;
				this.message = 'The microphone is blocked. You can listen; allow the mic in the address bar to talk.';
			}
			this.poweredAt = performance.now();
			this.epochs = {};
			this.world.start();
			void api.liveStatus().then((st) => {
				this.liveAvailable = st.available;
				this.live.byok = !!st.byok;
				if (this.live.byok && this.channel?.live && !this.live.active && !this.live.hasKey) this.enterLive();
			});
			this.startMeter();
			await this.tune(this.tuned, { silent: true });
			void this.loadRest();
		} catch (err) {
			this.fail(err);
		}
	}

	powerOff(): void {
		this.leaveLive();
		this.world.stop();
		this.token += 1;
		this.stopPlayback();
		this.clearTimer();
		cancelAnimationFrame(this.raf);
		this.level = 0;
		this.current = null;
		this.phase = 'off';
		this.audio?.click();
	}

	// ------------------------------------------------------------ tuning
	step(delta: number): void {
		if (!this.channels.length) return;
		const n = this.channels.length;
		void this.tune((this.tuned + delta + n) % n);
	}

	async tune(index: number, opts: { silent?: boolean } = {}): Promise<void> {
		if (this.phase === 'tx' && !this.channel?.live) return;
		const prev = this.tuned;
		this.tuned = index;
		if (this.phase === 'off') {
			this.audio?.click();
			return;
		}
		const token = ++this.token;
		this.stopPlayback();
		this.clearTimer();
		this.current = null;
		if (!opts.silent || prev !== index) {
			this.audio?.click();
			this.audio?.sweep();
		}
		const ch = this.channels[index];
		if (!ch) return;
		if (this.channels[prev]?.live && prev !== index) this.leaveLive();
		if (ch.live) {
			this.enterLive();
			return;
		}
		if (this.phase !== 'working') this.phase = 'tuning';
		await this.loadChannel(ch);
		if (token !== this.token) return;
		this.ensureEpoch(ch);
		if (this.phase !== 'working') this.phase = 'idle';
		this.schedule(token);
	}

	private async loadChannel(ch: Channel): Promise<void> {
		const existing = this.loading.get(ch.id);
		if (existing) return existing;
		const job = (async () => {
			let next = 0;
			const worker = async () => {
				while (next < ch.lines.length) {
					const i = next++;
					const key = `${ch.id}:${i}`;
					if (!this.buffers.has(key)) {
						const bytes = await api.getLine(ch.id, i);
						this.buffers.set(key, await this.audio!.decode(bytes));
					}
					this.loaded[ch.id] = (this.loaded[ch.id] ?? 0) + 1;
				}
			};
			await Promise.all([worker(), worker(), worker()]);
		})();
		this.loading.set(ch.id, job);
		try {
			await job;
		} catch (err) {
			this.loading.delete(ch.id);
			this.loaded[ch.id] = 0;
			throw err;
		}
	}

	private async loadRest(): Promise<void> {
		for (const ch of this.channels) {
			try {
				await this.loadChannel(ch);
			} catch {
				/* tuning to that channel will retry and show the error */
			}
		}
	}

	private loopLength(ch: Channel): number {
		return ch.lines.reduce((sum, ln) => sum + this.buffers.get(`${ch.id}:${ln.i}`)!.duration + ln.gap, 0);
	}

	private ensureEpoch(ch: Channel): void {
		if (this.epochs[ch.id] !== undefined) return;
		const total = this.loopLength(ch);
		const frac = START_AT[(ch.num - 1) % START_AT.length];
		// seconds into the loop at power-on
		const pos = frac < 0 ? total + frac : frac * total;
		this.epochs[ch.id] = this.poweredAt - pos * 1000;
	}

	/** Seconds into the channel's loop right now (or where it was frozen). */
	private loopPos(ch: Channel): number {
		const frozen = this.frozenAt[ch.id];
		if (frozen !== null && frozen !== undefined) return frozen;
		const total = this.loopLength(ch);
		const t = (performance.now() - this.epochs[ch.id]) / 1000;
		return ((t % total) + total) % total;
	}

	private freeze(ch: Channel): void {
		if (this.frozenAt[ch.id] === null) this.frozenAt[ch.id] = this.loopPos(ch);
	}

	private unfreeze(ch: Channel): void {
		const pos = this.frozenAt[ch.id];
		if (pos === null || pos === undefined) return;
		this.frozenAt[ch.id] = null;
		this.epochs[ch.id] = performance.now() - pos * 1000;
	}

	private schedule(token: number): void {
		if (token !== this.token) return;
		const ch = this.channel;
		if (!ch || this.phase === 'off' || this.phase === 'tx') return;
		if (this.pending[ch.id]?.length) {
			void this.playPending(ch, token);
			return;
		}
		if (this.frozenAt[ch.id] !== null) {
			// waiting for replies to your call on this channel
			return;
		}
		const pos = this.loopPos(ch);
		let start = 0;
		for (let k = 0; k < ch.lines.length; k += 1) {
			const ln = ch.lines[k];
			const buf = this.buffers.get(`${ch.id}:${ln.i}`)!;
			const end = start + buf.duration;
			if (pos < end - 0.25) {
				const offset = pos - start;
				if (offset >= 0) {
					void this.playLine(ch, k, offset, token);
				} else {
					this.wait(-offset, () => this.playLine(ch, k, 0, token), token);
				}
				return;
			}
			start = end + ln.gap;
		}
		// in the last gap: wait for the loop to wrap
		this.wait(this.loopLength(ch) - pos + 0.05, () => this.schedule(token), token);
	}

	private wait(seconds: number, fn: () => void, token: number): void {
		this.clearTimer();
		this.timer = setTimeout(() => {
			if (token === this.token) fn();
		}, Math.max(0, seconds * 1000));
	}

	private async playLine(ch: Channel, k: number, offset: number, token: number): Promise<void> {
		if (token !== this.token || !this.audio) return;
		const ln = ch.lines[k];
		const buf = this.buffers.get(`${ch.id}:${ln.i}`)!;
		const sp = ch.speakers[ln.speaker];
		const joinedMid = offset > 0.3;
		if (ln.at && sp.mobile) this.unitPos[ch.id][ln.speaker] = ln.at;
		this.applyBeats(ch, k, ln.speaker, ln.at, ln.place);
		await this.air(
			{
				channelId: ch.id,
				speaker: ln.speaker,
				label: sp.label,
				text: ln.text,
				place: ln.place,
				kind: 'loop',
				startedAt: performance.now() - offset * 1000,
				joinedMid,
				lineKey: `${ch.id}:${ln.i}`
			},
			buf,
			offset,
			token
		);
		if (token === this.token) this.schedule(token);
	}

	/** Put one clip on the air: squelch, voice, roger tone, log. */
	private async air(tx: Transmission, buf: AudioBuffer, offset: number, token: number): Promise<boolean> {
		if (!this.audio) return false;
		this.current = tx;
		if (tx.place) this.lastPlace = tx.place;
		if (this.phase !== 'working') this.phase = 'rx';
		this.addLog(tx);
		this.audio.squelchOpen(tx.joinedMid);
		this.playing = this.audio.play(buf, offset);
		const how = await this.playing.ended;
		this.playing = null;
		if (how === 'stopped' || token !== this.token) return false;
		this.audio.squelchTail();
		this.current = null;
		if (this.phase === 'rx') this.phase = 'idle';
		return true;
	}

	private async playPending(ch: Channel, token: number): Promise<void> {
		const queue = this.pending[ch.id];
		while (queue.length && token === this.token) {
			const item = queue[0];
			const sp = ch.speakers[item.call.speaker];
			if (sp?.mobile) this.unitPos[ch.id][item.call.speaker] = item.call.place;
			if (item.call.scene) this.applyScene(item.call.scene, 'reply');
			const done = await this.air(
				{
					channelId: ch.id,
					speaker: item.call.speaker,
					label: item.label,
					text: item.call.text,
					place: item.call.place,
					kind: 'reply',
					startedAt: performance.now(),
					joinedMid: false
				},
				item.buffer,
				0,
				token
			);
			if (!done) return; // interrupted; the rest stays queued
			queue.shift();
			this.pendingCount[ch.id] = queue.length;
			await new Promise((r) => setTimeout(r, 450));
		}
		if (token !== this.token) return;
		this.unfreeze(ch);
		this.wait(1.4, () => this.schedule(token), token);
	}

	// ------------------------------------------------------------ push to talk
	keyDown(): void {
		const ch = this.channel;
		if (!this.audio || !ch) return;
		if (ch.live) {
			// On channel 6 the mic is open while tuned. The big key becomes mute.
			if (this.live.state === 'live') this.live.toggleMute();
			return;
		}
		if (!['idle', 'rx', 'tuning'].includes(this.phase)) return;
		if (!this.micOk) {
			this.message = 'The microphone is blocked. Allow it in the address bar, then turn the radio off and on.';
			return;
		}
		if (this.epochs[ch.id] === undefined) return;
		this.token += 1;
		this.clearTimer();
		this.stopPlayback();
		this.current = null;
		this.freeze(ch);
		this.message = '';
		this.errorText = '';
		this.audio.keyDown();
		this.audio.startCapture();
		this.txStartedAt = performance.now();
		this.phase = 'tx';
		this.txTimer = setTimeout(() => void this.keyUp(), MAX_TX_S * 1000);
	}

	async keyUp(): Promise<void> {
		if (this.channel?.live) return;
		if (this.phase !== 'tx' || !this.audio) return;
		if (this.txTimer) clearTimeout(this.txTimer);
		const ch = this.channel!;
		const { wav, seconds } = this.audio.stopCapture();
		this.audio.keyUp();
		const token = ++this.token;
		if (seconds < MIN_TX_S) {
			this.message = 'Too short. Hold the button the whole time you talk.';
			this.unfreeze(ch);
			this.phase = 'idle';
			this.schedule(token);
			return;
		}
		this.phase = 'working';
		this.workStartedAt = performance.now();
		this.workStep = 'Pulse is transcribing';
		this.heard = '';
		try {
			const t0 = performance.now();
			const text = await api.stt(wav);
			const tPulse = (performance.now() - t0) / 1000;
			if (!text) {
				this.message = "Pulse didn't catch any words. Hold the button and talk a little closer.";
				this.finishWork(ch);
				return;
			}
			this.heard = text;
			this.addLog({
				channelId: ch.id,
				speaker: 'you',
				label: 'You',
				text,
				place: this.playerPlace,
				kind: 'you',
				startedAt: performance.now(),
				joinedMid: false
			});
			this.workStep = 'Electron is writing the reply';
			const t1 = performance.now();
			const history = this.log
				.filter((e) => e.channelId === ch.id)
				.slice(0, 8)
				.reverse()
				.map((e) => `${e.label}: ${e.text}`);
			const res = await api.reply(ch.id, text, history);
			const tLlm = (performance.now() - t1) / 1000;
			this.workStep = 'Lightning is voicing it';
			const t2 = performance.now();
			const clips = await Promise.all(
				res.calls.map(async (call) => ({
					call,
					label: ch.speakers[call.speaker]?.label ?? call.speaker,
					buffer: await this.audio!.decode(await api.tts(ch.id, call.speaker, call.text))
				}))
			);
			const tTts = (performance.now() - t2) / 1000;
			this.timings = { pulse: tPulse, electron: tLlm, lightning: tTts, source: res.source };
			this.pending[ch.id].push(...clips);
			this.pendingCount[ch.id] = this.pending[ch.id].length;
			this.finishWork(ch, false);
		} catch (err) {
			this.message = '';
			this.errorText = String((err as Error).message || err);
			this.finishWork(ch);
		}
	}

	private finishWork(origin: Channel, unfreeze = true): void {
		if (unfreeze) this.unfreeze(origin);
		this.workStep = '';
		this.phase = 'idle';
		const token = ++this.token;
		this.schedule(token);
	}

	// ------------------------------------------------------------ channel 6 and the world
	/** Tuning onto 6 waits a beat, so spinning the dial past it does not spend a session. */
	private enterLive(): void {
		this.clearLiveTimer();
		this.phase = 'idle';
		this.current = null;
		this.livePlace = null;
		if (!this.liveAvailable) {
			this.live.state = 'offline';
			this.live.notice = 'Channel 6 is offline. This server has no Smallest key set yet.';
			return;
		}
		this.live.state = 'idle';
		this.live.notice = '';
		if (this.live.byok && !this.live.hasKey) this.live.state = 'needkey';
		// channel 6 is the chopper's channel: the 3D view and the follow map ride with Sky Seven
		if (this.world.units.sky_seven) {
			this.world.focus = 'sky_seven';
			this.world.focusPlace = null;
		}
		if (this.live.state === 'needkey') return;
		this.liveTimer = setTimeout(() => void this.startLive(), 700);
	}

	/** Own-key mode: the visitor pasted a key on channel 6. False when it does not look like one. */
	useLiveKey(raw: string): boolean {
		if (!this.live.setKey(raw)) return false;
		if (this.channel?.live && this.phase !== 'off') {
			this.live.stop('');
			this.enterLive();
		}
		return true;
	}

	forgetLiveKey(): void {
		this.live.forgetKey();
		if (this.channel?.live && this.phase !== 'off') {
			this.live.stop('');
			this.enterLive();
		}
	}

	private async startLive(): Promise<void> {
		if (!this.channel?.live || this.phase === 'off') return;
		await this.ensureAllLoaded();
		this.startClocks();
		await this.live.start();
	}

	private leaveLive(): void {
		this.clearLiveTimer();
		if (this.clockTimer) clearInterval(this.clockTimer);
		this.clockTimer = null;
		this.live.stop('');
		if (this.current?.channelId === 'live') this.current = null;
	}

	private clearLiveTimer(): void {
		if (this.liveTimer) clearTimeout(this.liveTimer);
		this.liveTimer = null;
	}

	/** Channels keep running on their own clocks. Make sure we can read them while on channel 6. */
	private async ensureAllLoaded(): Promise<void> {
		for (const ch of this.channels) {
			if (ch.live) continue;
			try {
				await this.loadChannel(ch);
				this.ensureEpoch(ch);
			} catch {
				/* a channel that fails to load just does not feed the pilot */
			}
		}
	}

	/** While on channel 6, the other channels' lines still happen. Each new one moves the world and cues the pilot. */
	private startClocks(): void {
		if (this.clockTimer) clearInterval(this.clockTimer);
		this.clockSeen = {};
		this.clockTimer = setInterval(() => this.pollClocks(), 500);
	}

	private pollClocks(): void {
		if (this.live.state !== 'live') return;
		for (const ch of this.channels) {
			if (ch.live || this.epochs[ch.id] === undefined) continue;
			const pos = this.loopPos(ch);
			let start = 0;
			let idx = -1;
			for (let k = 0; k < ch.lines.length; k += 1) {
				const buf = this.buffers.get(`${ch.id}:${ch.lines[k].i}`);
				if (!buf) break;
				if (pos >= start && pos < start + buf.duration) {
					idx = k;
					break;
				}
				start += buf.duration + ch.lines[k].gap;
			}
			if (idx < 0 || this.clockSeen[ch.id] === idx) continue;
			const first = this.clockSeen[ch.id] === undefined;
			this.clockSeen[ch.id] = idx;
			if (first) continue;
			const ln = ch.lines[idx];
			const cue = this.applyBeats(ch, idx, ln.speaker, ln.at, ln.place, false);
			if (cue) this.live.cue(cue.unit, cue.place);
		}
	}

	/**
	 * One scripted line, as world movement. The scene comes from the server (channels.scene_for),
	 * the same mapping the tests pin, so the 3D view follows whoever the line is about.
	 * focus false (channel 6) moves units without taking the camera from the live pilot.
	 * Returns the thing worth telling the pilot about, if any.
	 */
	private applyBeats(
		ch: Channel,
		k: number,
		_speaker: string,
		_at: PlaceId | null,
		_place: PlaceId,
		focus = true
	): { unit: string; place: PlaceId } | null {
		const scene = ch.lines[k]?.scene;
		if (!scene) return null;
		return this.applyScene(scene, 'script', focus);
	}

	private applyScene(scene: Scene, source: 'script' | 'reply', focus = true): { unit: string; place: PlaceId } | null {
		// on channel 6 the live pilot flies Sky Seven; the scripted chopper lines do not take it over
		const keep = (u: string) => !(this.channel?.live && u === 'sky_seven');
		if (scene.bg && keep(scene.bg.unit)) this.world.move(scene.bg.unit, scene.bg.place, scene.bg.action as Action, source, { focus: false });
		if (keep(scene.unit)) this.world.move(scene.unit, scene.place, scene.action as Action, source, { focus });
		if (scene.cue) return { unit: scene.unit, place: scene.place };
		return scene.bg ? { unit: scene.bg.unit, place: scene.bg.place } : null;
	}

	private onLiveSpeaking(v: boolean): void {
		if (!this.channel?.live) return;
		if (v) {
			this.phase = 'rx';
			this.current = {
				channelId: 'live',
				speaker: 'sky_seven',
				label: 'Sky Seven',
				text: '',
				place: this.livePlace,
				kind: 'loop',
				startedAt: performance.now(),
				joinedMid: false
			};
			if (!this.world.focus) this.world.focus = 'sky_seven';
		} else {
			if (this.phase === 'rx') this.phase = 'idle';
			this.current = null;
		}
	}

	private onLiveUserSpeaking(v: boolean): void {
		if (!this.channel?.live) return;
		if (v) {
			this.txStartedAt = performance.now();
			this.phase = 'tx';
		} else if (this.phase === 'tx') this.phase = 'idle';
	}

	private onLiveCaption(text: string): void {
		if (this.current?.channelId === 'live') this.current = { ...this.current, text };
	}

	private onLiveHighlight(place: PlaceId): void {
		this.livePlace = place;
		this.lastPlace = place;
		this.liveHighlightAt = performance.now();
		if (this.current?.channelId === 'live') this.current = { ...this.current, place, startedAt: performance.now() };
	}

	private onLiveLog(e: { text: string; interrupted: boolean }): void {
		this.addLog({
			channelId: 'live',
			speaker: 'sky_seven',
			label: 'Sky Seven',
			text: e.interrupted ? `${e.text} (cut off)` : e.text,
			place: this.livePlace,
			kind: 'loop',
			startedAt: performance.now(),
			joinedMid: false
		});
	}

	private onDeskCue(query: string): void {
		const q = new URLSearchParams(query);
		const info = this.world.info[q.get('u') ?? ''];
		const place = this.places[q.get('p') ?? ''];
		const text =
			q.get('k') === 'at' && info && place
				? `Desk to Sky Seven. ${info.label} is now at ${place.name}.`
				: 'Desk to Sky Seven. Anything new from up there?';
		this.addLog({
			channelId: 'live',
			speaker: 'studio',
			label: 'Studio',
			text,
			place: place ? (q.get('p') as PlaceId) : null,
			kind: 'loop',
			startedAt: performance.now(),
			joinedMid: false
		});
	}

	/** What the map draws for the tuned channel: its speakers, plus the moving things around the story. */
	get markers(): Marker[] {
		const ch = this.channel;
		if (!ch) return [];
		const out: Marker[] = [];
		const w = this.world;
		const cur = this.current;
		const unitMarker = (uid: string, speaker: string, active: boolean): Marker | null => {
			const info = w.info[uid];
			const u = w.units[uid];
			if (!info || !u) return null;
			return {
				id: uid,
				speaker,
				label: info.label,
				short: info.tag,
				mobile: true,
				kind: info.kind,
				x: u.x,
				y: u.y,
				active
			};
		};
		if (ch.live) {
			for (const uid of Object.keys(w.info)) {
				const m = unitMarker(uid, uid, cur?.channelId === 'live' && uid === 'sky_seven');
				if (m) out.push(m);
			}
			return out;
		}
		const unitPos = this.unitPos[ch.id] ?? {};
		for (const [sid, sp] of Object.entries(ch.speakers)) {
			const active = cur?.kind !== 'you' && cur?.speaker === sid;
			const uid = this.beats.speakers[`${ch.id}:${sid}`];
			const m = sp.mobile && uid ? unitMarker(uid, sid, active) : null;
			if (m) out.push(m);
			else {
				const p = this.places[unitPos[sid] ?? sp.home];
				out.push({ id: sid, speaker: sid, label: sp.label, short: sp.tag, mobile: sp.mobile, kind: 'fixed', x: p?.x ?? 0, y: p?.y ?? 0, active });
			}
		}
		// The jet ski and the walkers belong to the story on these channels.
		const prefix = `${ch.id}:`;
		const extra = new Set<string>();
		for (const k of Object.keys(this.beats.jet)) if (k.startsWith(prefix)) extra.add('jet_ski');
		for (const [k, v] of Object.entries(this.beats.person)) if (k.startsWith(prefix)) extra.add(v.unit);
		for (const uid of extra) {
			const m = unitMarker(uid, uid, false);
			if (m) out.push(m);
		}
		return out;
	}

	// ------------------------------------------------------------ misc
	setVolume(v: number): void {
		this.volume = Math.max(0, Math.min(1, Math.round(v * 20) / 20));
		if (this.audio) this.audio.volume = this.volume;
	}

	tick(): void {
		this.audio?.click();
	}

	private lastLineKey: Record<string, string> = {};

	private addLog(tx: Transmission): void {
		if (tx.lineKey) {
			if (this.lastLineKey[tx.channelId] === tx.lineKey) return;
			this.lastLineKey[tx.channelId] = tx.lineKey;
		}
		this.logId += 1;
		this.log.unshift({
			id: this.logId,
			channelId: tx.channelId,
			clock: clockNow(),
			label: tx.label,
			text: tx.text,
			place: tx.place,
			kind: tx.kind
		});
		if (this.log.length > 60) this.log.length = 60;
	}

	private startMeter(): void {
		cancelAnimationFrame(this.raf);
		let smooth = 0;
		const loop = () => {
			if (!this.audio) return;
			const raw =
				this.phase === 'tx'
					? this.audio.micLevel()
					: this.playing || this.live.speaking
						? this.audio.rxLevel()
						: 0;
			smooth = raw > smooth ? raw : smooth * 0.82 + raw * 0.18;
			const q = Math.round(smooth * 40) / 40;
			if (q !== this.level) this.level = q;
			this.raf = requestAnimationFrame(loop);
		};
		this.raf = requestAnimationFrame(loop);
	}

	private stopPlayback(): void {
		this.audio?.hush();
		this.playing?.stop();
		this.playing = null;
	}

	private clearTimer(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	private fail(err: unknown): void {
		this.errorText = String((err as Error)?.message || err);
		this.phase = 'error';
	}
}
