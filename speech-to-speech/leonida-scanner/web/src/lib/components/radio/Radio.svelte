<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Power from '@lucide/svelte/icons/power';
	import Knob from './Knob.svelte';
	import type { Scanner } from '#lib/scanner/scanner.svelte.js';

	let { scanner, compact = false }: { scanner: Scanner; compact?: boolean } = $props();

	const CH_SPAN = 240; // degrees the channel knob covers
	const VOL_SPAN = 270;

	let held = $state(false);
	let now = $state(performance.now());

	const ch = $derived(scanner.channel);
	const count = $derived(Math.max(scanner.channels.length, 5));
	const on = $derived(scanner.phase !== 'off');
	const chAngle = $derived(-CH_SPAN / 2 + (scanner.tuned / (count - 1)) * CH_SPAN);
	const volAngle = $derived(-VOL_SPAN / 2 + scanner.volume * VOL_SPAN);
	const marks = $derived(
		Array.from({ length: count }, (_, i) => ({
			angle: -CH_SPAN / 2 + (i / (count - 1)) * CH_SPAN,
			text: String(i + 1),
			active: on && i === scanner.tuned
		}))
	);
	const bars = $derived(Math.round(scanner.level * 10));
	const led = $derived(scanner.phase === 'tx' ? 'tx' : scanner.phase === 'rx' ? 'rx' : on ? 'idle' : 'off');
	const ticking = $derived(['rx', 'tx', 'working', 'tuning'].includes(scanner.phase));

	$effect(() => {
		if (!ticking) return;
		const id = setInterval(() => (now = performance.now()), 100);
		return () => clearInterval(id);
	});

	function secs(from: number): string {
		return Math.max(0, (now - from) / 1000).toFixed(1) + 's';
	}

	const isLive = $derived(!!ch?.live);
	const liveLine = $derived.by(() => {
		const l = scanner.live;
		const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
		switch (l.state) {
			case 'minting':
			case 'connecting':
				return { line: 'Calling Sky Seven', right: '' };
			case 'live':
				if (l.speaking) return { line: 'Sky Seven, live', right: mmss(l.remaining) };
				if (l.userSpeaking) return { line: 'You are on the air', right: mmss(l.remaining) };
				return { line: l.muted ? 'Mic muted' : 'Open mic, just talk', right: mmss(l.remaining) };
			case 'needkey':
				return { line: 'Needs your Smallest key', right: '' };
			case 'offline':
				return { line: 'Channel 6 offline', right: '' };
			case 'busy':
				return { line: 'Channel 6 is full', right: '' };
			case 'ended':
				return { line: 'Call ended', right: '' };
			case 'error':
				return { line: 'Could not connect', right: '' };
			default:
				return { line: 'Standing by', right: '' };
		}
	});

	const status = $derived.by(() => {
		if (isLive) return liveLine;
		const p = scanner.phase;
		if (p === 'booting') return { line: 'Starting', right: '' };
		if (p === 'tuning') return { line: `Tuning ${scanner.loadedCount} of ${ch?.lines.length ?? 0}`, right: '' };
		if (p === 'rx' && scanner.current)
			return { line: scanner.current.label, right: secs(scanner.current.startedAt) };
		if (p === 'tx') return { line: 'You are on the air', right: secs(scanner.txStartedAt) };
		if (p === 'working') return { line: scanner.workStep || 'Working', right: secs(scanner.workStartedAt) };
		if (p === 'error') return { line: 'Error, see below', right: '' };
		const waiting = ch ? (scanner.pendingCount[ch.id] ?? 0) : 0;
		return { line: waiting ? `${waiting} ${waiting === 1 ? 'reply' : 'replies'} queued` : 'Squelched, quiet', right: '' };
	});

	function down(e: PointerEvent) {
		if (!on) return;
		if (isLive) {
			scanner.keyDown(); // toggles mute
			return;
		}
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		held = true;
		scanner.keyDown();
	}
	function up() {
		if (!held) return;
		held = false;
		void scanner.keyUp();
	}
	function stepVolume(d: number) {
		scanner.setVolume(scanner.volume + d * 0.05);
		scanner.tick();
	}
	const pttDisabled = $derived(
		isLive
			? !on || scanner.live.state !== 'live'
			: !on || scanner.phase === 'working' || scanner.phase === 'booting' || !scanner.micOk
	);
	const txing = $derived(scanner.phase === 'tx');
	const muted = $derived(isLive && scanner.live.muted);
</script>

<div class="radio" class:compact class:off={!on}>
	<div class="antenna" aria-hidden="true">
		<svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 30 100">
			{#each [14, 24, 34, 44, 54, 64] as y (y)}
				<line x1="5" x2="25" y1={y} y2={y} />
			{/each}
		</svg>
	</div>
	<div class="body">
		<div class="deck">
			<div class="dial">
				<Knob
					angle={chAngle}
					size={compact ? 46 : 60}
					label="Channel"
					valueText={ch ? `Channel ${ch.num}, ${ch.name}` : 'Channel'}
					{marks}
					onstep={(d) => scanner.step(d)}
				/>
				<span class="engrave">Channel</span>
			</div>
			<div class="mid">
				<div class="ledrow">
					<span class="led {led}" aria-hidden="true"></span>
					<span class="engrave">{led === 'tx' ? 'TX' : led === 'rx' ? 'RX' : 'TX / RX'}</span>
				</div>
				<button
					type="button"
					class="key power"
					class:lit={on}
					aria-label={on ? 'Turn radio off' : 'Turn radio on'}
					aria-pressed={on}
					onclick={() => (on ? scanner.powerOff() : scanner.powerOn())}
				>
					<Power size={16} strokeWidth={2} />
				</button>
			</div>
			<div class="dial">
				<Knob
					angle={volAngle}
					size={compact ? 36 : 44}
					label="Volume"
					valueText={`Volume ${Math.round(scanner.volume * 100)}`}
					onstep={stepVolume}
				/>
				<span class="engrave">Volume</span>
			</div>
		</div>

		<div class="lcd" class:dark={!on} aria-live="polite">
			{#if on}
				<div class="row top">
					<div class="chan">
						<span class="small">CH</span>
						<span class="digits"
							><span class="ghost" aria-hidden="true">88</span><span class="live"
								>{String(ch?.num ?? scanner.tuned + 1).padStart(2, '0')}</span
							></span
						>
					</div>
					<div class="meter">
						<span class="flag" class:inv={led === 'rx'}>RX</span>
						<span class="flag" class:inv={led === 'tx'}>TX</span>
						<div class="bars" aria-label="Audio level">
							{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
								<span class:lit={i < bars} style:height="{5 + i * 1.6}px"></span>
							{/each}
						</div>
					</div>
				</div>
				<div class="row name">{ch?.name ?? 'Loading channels'}</div>
				<div class="row status">
					<span class="trunc">{status.line}</span>
					<span class="num">{status.right}</span>
				</div>
				<div class="row vol">
					<span>Vol</span>
					<span class="volbar">
						{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
							<span class:lit={i < Math.round(scanner.volume * 10)}></span>
						{/each}
					</span>
				</div>
			{:else}
				<span class="sr-only">Radio is off</span>
			{/if}
		</div>

		<div class="plate">
			<span>Kestrel KR-5</span>
			<span>Six channel scanner</span>
		</div>

		<div class="controls">
			<button type="button" class="key side" aria-label="Previous channel" disabled={!on} onclick={() => scanner.step(-1)}>
				<ChevronLeft size={18} strokeWidth={2} />
			</button>
			<button
				type="button"
				class="ptt"
				class:held={txing}
				class:muted
				disabled={pttDisabled}
				aria-label={isLive
					? muted
						? 'Microphone muted. Press to unmute.'
						: 'Microphone open. Press to mute.'
					: 'Push to talk. Hold to transmit, release to send.'}
				aria-pressed={isLive ? muted : txing}
				onpointerdown={down}
				onpointerup={up}
				onpointercancel={up}
				onlostpointercapture={up}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<svg class="grip" viewBox="0 0 24 40" aria-hidden="true">
					{#each [8, 16, 24, 32] as y (y)}<line x1="4" x2="20" y1={y} y2={y} />{/each}
				</svg>
				<span class="ptt-label">
					<span class="big">{isLive ? (muted ? 'Unmute mic' : 'Mute mic') : 'Push to talk'}</span>
					<span class="hint"
						>{isLive ? 'Or press Space' : txing ? 'Release to send' : 'Or hold Space'}</span
					>
				</span>
				<svg class="grip" viewBox="0 0 24 40" aria-hidden="true">
					{#each [8, 16, 24, 32] as y (y)}<line x1="4" x2="20" y1={y} y2={y} />{/each}
				</svg>
			</button>
			<button type="button" class="key side" aria-label="Next channel" disabled={!on} onclick={() => scanner.step(1)}>
				<ChevronRight size={18} strokeWidth={2} />
			</button>
		</div>

		<svg class="grille" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
			<defs>
				<pattern id="holes" width="11" height="11" patternUnits="userSpaceOnUse">
					<circle cx="5.5" cy="5.5" r="2.3" />
				</pattern>
			</defs>
			<rect width="100%" height="100%" rx="12" fill="url(#holes)" />
		</svg>
	</div>
</div>

<style>
	.radio {
		--shell: #2b2c29;
		--shell-edge: #121311;
		--shell-line: #3b3c37;
		--rubber: #1b1c1a;
		--engrave: #8f8d84;
		--lcd: #b9c2a0;
		--lcd-ink: #1c2417;
		position: relative;
		width: 340px;
		padding-top: 50px;
		user-select: none;
		-webkit-user-select: none;
		font-family: var(--sans);
	}
	.radio.compact {
		width: 100%;
		max-width: 400px;
		padding-top: 26px;
	}
	.antenna {
		position: absolute;
		top: 0;
		left: 48px;
		width: 30px;
		height: 82px;
		background: var(--rubber);
		border: 1px solid var(--shell-edge);
		border-radius: 12px 12px 4px 4px;
	}
	.compact .antenna {
		height: 50px;
		left: 40px;
		width: 26px;
	}
	.antenna line {
		stroke: #2c2d2a;
		stroke-width: 2;
	}
	.body {
		position: relative;
		background: var(--shell);
		border: 1px solid var(--shell-edge);
		border-radius: 36px 36px 30px 30px;
		padding: 14px 18px 18px;
		outline: 1px solid var(--shell-line);
		outline-offset: -5px;
	}
	.compact .body {
		padding: 4px 14px 12px;
		border-radius: 28px 28px 24px 24px;
	}
	.deck {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.dial {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
	}
	.engrave {
		font-size: 12px;
		font-weight: 500;
		color: var(--engrave);
		letter-spacing: 0.01em;
	}
	.mid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.ledrow {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 74px;
		justify-content: center;
	}
	.led {
		width: 12px;
		height: 12px;
		border-radius: 999px;
		background: #45463f;
		border: 1px solid #10110f;
		transition: background-color 100ms;
	}
	.led.idle {
		background: #5d5e55;
	}
	.led.rx {
		background: #4cb276;
	}
	.led.tx {
		background: #e2442f;
	}
	.key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 40px;
		border-radius: 10px;
		border: 1px solid var(--shell-edge);
		border-bottom-width: 3px;
		background: var(--rubber);
		color: #b9b5a8;
		cursor: pointer;
		transition: transform 60ms, border-bottom-width 60ms;
	}
	.key:active:not(:disabled) {
		transform: translateY(2px);
		border-bottom-width: 1px;
	}
	.key:disabled {
		color: #55564f;
		cursor: default;
	}
	.key:focus-visible,
	.ptt:focus-visible {
		outline: 2px solid var(--blue);
		outline-offset: 2px;
	}
	.power.lit {
		color: #ece6d8;
	}

	.lcd {
		margin-top: 8px;
		height: 128px;
		border-radius: 10px;
		background: var(--lcd);
		border: 3px solid #151614;
		color: var(--lcd-ink);
		font-family: var(--mono);
		padding: 8px 12px;
		display: grid;
		grid-template-rows: auto auto auto 1fr;
		gap: 2px;
		transition: background-color 200ms;
	}
	.compact .lcd {
		height: 112px;
		padding: 5px 12px 6px;
		margin-top: 2px;
	}
	.lcd.dark {
		background: #6f7660;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
	}
	.chan {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.small {
		font-size: 12px;
		font-weight: 600;
	}
	.digits {
		position: relative;
		font-size: 34px;
		line-height: 1;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.compact .digits {
		font-size: 30px;
	}
	.ghost {
		position: absolute;
		inset: 0;
		opacity: 0.09;
	}
	.live {
		position: relative;
	}
	.meter {
		display: flex;
		align-items: flex-end;
		gap: 6px;
	}
	.flag {
		font-size: 12px;
		font-weight: 700;
		padding: 0 4px;
		border-radius: 3px;
		opacity: 0.18;
		line-height: 18px;
	}
	.flag.inv {
		opacity: 1;
		background: var(--lcd-ink);
		color: var(--lcd);
	}
	.bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 22px;
		margin-left: 2px;
	}
	.bars span {
		width: 4px;
		background: var(--lcd-ink);
		opacity: 0.12;
	}
	.bars span.lit {
		opacity: 1;
	}
	.name {
		font-size: 16px;
		font-weight: 600;
	}
	.status {
		font-size: 13px;
	}
	.trunc {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.vol {
		font-size: 12px;
		justify-content: flex-start;
		align-self: end;
	}
	.volbar {
		display: inline-flex;
		gap: 2px;
	}
	.volbar span {
		width: 7px;
		height: 6px;
		background: var(--lcd-ink);
		opacity: 0.14;
	}
	.volbar span.lit {
		opacity: 0.85;
	}

	.plate {
		display: flex;
		justify-content: space-between;
		margin: 10px 4px 10px;
		font-size: 12px;
		color: var(--engrave);
	}
	.plate span:first-child {
		font-weight: 700;
		color: #a9a69b;
	}
	.compact .plate {
		margin: 5px 4px 7px;
	}

	.controls {
		display: flex;
		align-items: stretch;
		gap: 10px;
	}
	.side {
		height: auto;
		width: 44px;
	}
	.ptt {
		flex: 1;
		height: 92px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		border-radius: 18px;
		border: 1px solid #0b0c0a;
		border-bottom-width: 5px;
		background: var(--rubber);
		color: #e7e1d3;
		cursor: pointer;
		touch-action: none;
		transition:
			transform 60ms,
			border-bottom-width 60ms,
			background-color 100ms;
	}
	.compact .ptt {
		height: 76px;
	}
	.ptt.held {
		transform: translateY(4px);
		border-bottom-width: 1px;
		background: #141513;
	}
	.ptt.muted {
		transform: translateY(4px);
		border-bottom-width: 1px;
		background: #141513;
		color: #f0b9ae;
	}
	.ptt:disabled {
		color: #6c6d65;
		cursor: default;
	}
	.grip {
		width: 22px;
		height: 40px;
	}
	.grip line {
		stroke: #30312d;
		stroke-width: 2.5;
		stroke-linecap: round;
	}
	.ptt-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.big {
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.hint {
		font-size: 14px;
		color: #a5a196;
	}
	.ptt:disabled .hint {
		color: #5d5e57;
	}
	.grille {
		display: block;
		width: 100%;
		height: 44px;
		margin-top: 12px;
	}
	.compact .grille {
		height: 26px;
		margin-top: 8px;
	}
	.grille circle {
		fill: #161715;
	}
</style>
