<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Kbd } from '#lib/components/ui/kbd/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import Radio from '#lib/components/radio/Radio.svelte';
	import LiveKey from '#lib/components/radio/LiveKey.svelte';
	import CityMap from '#lib/components/map/CityMap.svelte';
	import { Scanner } from '#lib/scanner/scanner.svelte.js';
	import { inSentence } from '#lib/scanner/text.js';
	import type { Component } from 'svelte';

	type SceneProps = { world: Scanner['world']; expanded?: boolean };
	let Scene3D = $state<Component<SceneProps> | null>(null);
	let view3d = $state<'inset' | 'full' | 'hidden'>('inset');
	let webgl = $state(true);

	const scanner = new Scanner();

	// ?lab3d exposes the world to the console, for the headless screenshot script. Client only.
	$effect(() => {
		if (new URLSearchParams(location.search).has('lab3d')) Object.assign(window as unknown as Record<string, unknown>, { __world: scanner.world, __live: scanner.live });
	});

	let compact = $state(false);
	let mapMode = $state<'city' | 'follow'>('city');
	let now = $state(performance.now());

	$effect(() => {
		const mq = window.matchMedia('(max-width: 1023px)');
		const apply = () => {
			compact = mq.matches;
			mapMode = mq.matches ? 'follow' : 'city';
		};
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	});

	const on = $derived(scanner.phase !== 'off');
	const ch = $derived(scanner.channel);
	const txing = $derived(scanner.phase === 'tx');
	const working = $derived(scanner.phase === 'working');
	const channelLog = $derived(ch ? scanner.log.filter((e) => e.channelId === ch.id).slice(0, 14) : []);
	const notice = $derived(scanner.errorText || scanner.message);
	const ticking = $derived(txing || working);
	const focusInfo = $derived(scanner.world.focus ? scanner.world.info[scanner.world.focus] : null);
	const focusPlaceName = $derived(
		scanner.world.focus === 'sky_seven' && scanner.world.sky
			? scanner.world.sky.label
			: scanner.world.focusPlace
				? scanner.places[scanner.world.focusPlace]?.name
				: ''
	);
	const liveNote = $derived.by(() => {
		if (!ch?.live) return '';
		const st = scanner.live.state;
		if (st === 'offline' || st === 'busy' || st === 'ended' || st === 'error') return scanner.live.notice;
		if (st === 'live') return 'Open line. Wear headphones, or the pilot will hear the speakers. Space mutes.';
		return '';
	});

	const keyBox = $derived(on && !!ch?.live && (scanner.live.state === 'needkey' || (scanner.live.byok && scanner.live.hasKey)));

	$effect(() => {
		if (!on || Scene3D || !webgl) return;
		try {
			const c = document.createElement('canvas');
			if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('no webgl');
		} catch {
			webgl = false;
			return;
		}
		void import('#lib/components/scene/Scene3D.svelte').then((m) => (Scene3D = m.default as unknown as Component<SceneProps>));
	});

	$effect(() => {
		if (!ticking) return;
		const id = setInterval(() => (now = performance.now()), 100);
		return () => clearInterval(id);
	});

	const chip = $derived.by(() => {
		switch (scanner.phase) {
			case 'off':
				return { text: 'Radio off', tone: 'idle' };
			case 'booting':
				return { text: 'Starting', tone: 'work' };
			case 'tuning':
				return { text: `Tuning channel ${ch?.num ?? ''}`, tone: 'work' };
			case 'rx':
				return { text: `Receiving on ${ch?.num ?? ''}`, tone: 'live' };
			case 'tx':
				return { text: 'Transmitting', tone: 'live' };
			case 'working':
				return { text: 'Working on a reply', tone: 'work' };
			case 'error':
				return { text: 'Something broke', tone: 'err' };
			default:
				return { text: `Listening on ${ch?.num ?? ''}`, tone: 'idle' };
		}
	});

	function typing(e: KeyboardEvent): boolean {
		const el = e.target as HTMLElement | null;
		return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
	}

	function keydown(e: KeyboardEvent) {
		if (typing(e)) return;
		if (e.code === 'Space') {
			e.preventDefault();
			if (!e.repeat && on) scanner.keyDown();
			return;
		}
		if (!on || e.repeat) return;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			scanner.step(1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			scanner.step(-1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			scanner.setVolume(scanner.volume + 0.05);
			scanner.tick();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			scanner.setVolume(scanner.volume - 0.05);
			scanner.tick();
		}
	}
	function keyup(e: KeyboardEvent) {
		if (e.code === 'Space' && !typing(e)) {
			e.preventDefault();
			void scanner.keyUp();
		}
	}

	onDestroy(() => scanner.powerOff());

	const secs = (from: number) => Math.max(0, (now - from) / 1000).toFixed(1) + 's';
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onblur={() => void scanner.keyUp()} />

{#snippet statusChip()}
	<Badge variant="outline" class="h-7 gap-2 rounded-md bg-surface px-2.5 text-sm font-medium text-ink">
		<span class="dot {chip.tone}" class:animate-pulse={chip.tone === 'live'} aria-hidden="true"></span>
		<span aria-live="polite">{chip.text}</span>
	</Badge>
{/snippet}

{#snippet caption()}
	{#if txing}
		<div class="caption">
			<div class="who"><span class="live-dot"></span>You, transmitting <span class="num">{secs(scanner.txStartedAt)}</span></div>
			<p class="said muted">Talk, then let go.</p>
		</div>
	{:else if working}
		<div class="caption">
			<div class="who">{scanner.workStep} <span class="num">{secs(scanner.workStartedAt)}</span></div>
			<p class="said">{scanner.heard ? `Pulse heard: "${scanner.heard}"` : 'Sending your clip to Pulse.'}</p>
		</div>
	{:else if scanner.current}
		<div class="caption">
			<div class="who">
				{scanner.current.label}{#if scanner.current.place && scanner.places[scanner.current.place]}<span class="where">
						· {scanner.places[scanner.current.place].name}</span
					>{/if}
			</div>
			<p class="said">{scanner.current.text}</p>
		</div>
	{/if}
{/snippet}

{#snippet noticeBox()}
	{#if notice}
		<div class="notice" class:err={!!scanner.errorText} role={scanner.errorText ? 'alert' : 'status'}>
			<p>{notice}</p>
			{#if scanner.errorText}
				<p class="next">Nothing was lost. Hold the button and try again{scanner.phase === 'error' ? ', or press power' : ''}.</p>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet mapFrame(cls: string)}
	<div class="frame {cls}">
		<CityMap
			places={scanner.places}
			channel={ch}
			markers={scanner.markers}
			current={scanner.current}
			lastPlace={scanner.lastPlace}
			playerPlace={scanner.playerPlace}
			mode={mapMode}
			{txing}
			{on}
			bottomPad={compact ? 84 : 92}
			followWidth={compact ? 760 : 560}
		/>
		{#if !on}
			<div class="empty">
				<p>The radio is off. Turn it on to hear six channels of Port Ibis, one of them live.</p>
			</div>
		{/if}
		{#if on && webgl}
			{#if view3d === 'hidden'}
				<Button variant="secondary" size="sm" class="view3d-open" onclick={() => (view3d = 'inset')}>3D view</Button>
			{:else}
				<div class="inset" class:full={view3d === 'full'} class:cmp={compact}>
					{#if Scene3D}
						<Scene3D world={scanner.world} expanded={view3d === 'full'} />
					{:else}
						<div class="inset-wait">Loading 3D view</div>
					{/if}
					<div class="inset-bar">
						<span class="inset-who">
							{#if focusInfo}Following {inSentence(focusInfo.label)}{#if focusPlaceName}&nbsp;<span class="where">to {focusPlaceName}</span>{/if}{:else}3D view{/if}
						</span>
						<span class="inset-btns">
							<Button variant="secondary" size="sm" class="h-7 px-2.5 text-[13px]" onclick={() => (view3d = view3d === 'full' ? 'inset' : 'full')}>
								{view3d === 'full' ? 'Shrink' : 'Zoom'}
							</Button>
							<Button variant="secondary" size="sm" class="h-7 px-2.5 text-[13px]" onclick={() => (view3d = 'hidden')}>Hide</Button>
						</span>
					</div>
				</div>
			{/if}
		{/if}
		{@render caption()}
		{#if compact}
			<div class="overlay-top">
				<span class="disclaimer-chip">Fan-made. Not affiliated with Rockstar Games.</span>
				<Tabs.Root value={mapMode} onValueChange={(v) => (mapMode = v as 'city' | 'follow')}>
					<Tabs.List class="map-tabs">
						<Tabs.Trigger value="city">City</Tabs.Trigger>
						<Tabs.Trigger value="follow">Follow</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>
			</div>
		{/if}
	</div>
{/snippet}

{#if compact}
	<div class="m-shell">
		<header class="m-head">
			<div class="flex items-baseline gap-2">
				<span class="text-[1.0625rem] font-semibold tracking-tight">Leonida Scanner</span>
			</div>
			{#if on}
				{@render statusChip()}
			{:else}
				<Button size="lg" class="h-10 px-4" onclick={() => scanner.powerOn()}>Turn on radio</Button>
			{/if}
		</header>
		{@render mapFrame('m-map')}
		{#if notice || liveNote || keyBox}<div class="grid gap-2 px-3 pt-2">{#if keyBox}<LiveKey {scanner} />{/if}{#if liveNote}<div class="notice" role="status"><p>{liveNote}</p></div>{/if}{@render noticeBox()}</div>{/if}
		<div class="m-radio">
			<Radio {scanner} compact />
		</div>
	</div>
{:else}
	<div class="d-shell">
		<header class="d-head">
			<div class="flex items-baseline gap-3">
				<span class="text-[1.0625rem] font-semibold tracking-tight">Leonida Scanner</span>
				<span class="text-sm text-ink-3">A walkie-talkie for Port Ibis, a city that does not exist</span>
			</div>
			{@render statusChip()}
		</header>

		<main class="d-main">
			<section class="left">
				<Radio {scanner} />
				<div class="under">
					{#if !on}
						<Button size="lg" class="h-11 w-full text-[0.9375rem]" onclick={() => scanner.powerOn()}>Turn on radio</Button>
						<p class="text-sm text-ink-2">Six channels, all talking right now. Flip the dial to drop in. Channel 6 is a live pilot you can talk to.</p>
					{:else}
						<div class="keys">
							<span><Kbd>Space</Kbd> talk</span>
							<span><Kbd>←</Kbd><Kbd>→</Kbd> channel</span>
							<span><Kbd>↑</Kbd><Kbd>↓</Kbd> volume</span>
						</div>
					{/if}
					{#if keyBox}<LiveKey {scanner} />{/if}
					{#if liveNote}<div class="notice" role="status"><p>{liveNote}</p></div>{/if}
					{@render noticeBox()}
				</div>
			</section>

			<section class="right">
				<div class="right-head">
					<div class="min-w-0">
						<h1 class="text-[1.4375rem]">{ch ? `Channel ${ch.num}, ${ch.name}` : 'Six channels, one radio'}</h1>
						<p class="mt-1 text-sm text-ink-3">{ch ? ch.tagline : 'Hold the button to talk to whoever is on the channel.'}</p>
					</div>
					<Tabs.Root value={mapMode} onValueChange={(v) => (mapMode = v as 'city' | 'follow')}>
						<Tabs.List>
							<Tabs.Trigger value="city">City</Tabs.Trigger>
							<Tabs.Trigger value="follow">Follow</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>
				</div>

				{@render mapFrame('d-map')}

				<div class="log" class:live={ch?.live}>
					<div class="log-head">
						<span class="font-semibold">Heard on this channel</span>
						{#if ch?.live}
							<span class="text-sm text-ink-3">Live on Hydra, speech to speech.</span>
						{:else if scanner.timings}
							<span class="font-mono text-[13px] text-ink-3 num"
								>Last reply: Pulse {scanner.timings.pulse.toFixed(1)}s · {scanner.timings.source === 'electron'
									? `Electron ${scanner.timings.electron.toFixed(1)}s`
									: 'canned fallback'} · Lightning {scanner.timings.lightning.toFixed(1)}s</span
							>
						{:else}
							<span class="text-sm text-ink-3">Voices: Lightning. Your mic: Pulse. Replies: Electron.</span>
						{/if}
					</div>
					<div class="log-body">
						{#if channelLog.length}
							<ol class="rows">
								{#each channelLog as e, idx (e.id)}
									<li class:sel={idx === 0 && (scanner.current?.channelId === e.channelId || e.kind === 'you')} class:you={e.kind === 'you'}>
										<span class="t num">{e.clock}</span>
										<span class="w">{e.label}</span>
										<span class="x">{e.text}</span>
									</li>
								{/each}
							</ol>
						{:else}
							<p class="log-empty">{on ? 'Nothing heard on this channel yet.' : 'Turn the radio on to start listening.'}</p>
						{/if}
						{#if ch?.live}
							<section class="calls" aria-label="Tool calls from the pilot">
								<div class="calls-head">
									<span class="font-semibold">Tool calls</span>
									<span class="text-ink-3">what Hydra asked the map to do</span>
								</div>
								{#if scanner.live.calls.length}
									<ol class="call-rows">
										{#each scanner.live.calls.slice(0, 5) as c, idx (c.id)}
											<li class:sel={idx === 0} class:bad={!c.ok} class:speech={c.via === 'speech'}>
												<span class="t num">{c.clock}</span>
												<span class="c"
													><b>{c.via === 'speech' ? `${c.name} (from speech)` : c.name}</b> {c.args}<br /><span class="r">→ {c.result}</span></span
												>
											</li>
										{/each}
									</ol>
								{:else}
									<p class="log-empty">No tool calls yet. Ask him to fly somewhere.</p>
								{/if}
							</section>
						{/if}
					</div>
				</div>
			</section>
		</main>

		<footer class="d-foot">
			Fan-made radio play. Not affiliated with Rockstar Games. Original city, voices and text. Codes are invented.
		</footer>
	</div>
{/if}

<style>
	/* desktop */
	.d-shell {
		max-width: 1180px;
		margin: 0 auto;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 0 32px;
	}
	.d-head {
		height: 56px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
	}
	.d-main {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 360px minmax(0, 1fr);
		gap: 40px;
		padding: 20px 0 12px;
	}
	.left {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
	}
	.under {
		width: 100%;
		max-width: 340px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.keys {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		font-size: 14px;
		color: var(--ink-2);
	}
	.keys span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.right {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
	}
	.right-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}
	.frame {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--line-strong);
		border-radius: 14px;
		background: #18252c;
	}
	.d-map {
		flex: 1;
		min-height: 260px;
	}
	.log {
		flex: none;
		height: 150px;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		overflow: hidden;
	}
	.log.live {
		height: 210px;
	}
	.log-body {
		flex: 1;
		min-height: 0;
		display: flex;
	}
	.log-body > .rows,
	.log-body > .log-empty {
		flex: 1;
		min-width: 0;
	}
	.calls {
		flex: 0 0 52%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--line);
	}
	.calls-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 6px 16px 2px;
		font-size: 13px;
	}
	.call-rows {
		overflow-y: auto;
		margin: 0;
		padding: 2px 0 4px;
		list-style: none;
		font-family: var(--mono);
		font-size: 12.5px;
		line-height: 18px;
	}
	.call-rows li {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr);
		gap: 10px;
		padding: 3px 16px 3px 13px;
		border-left: 3px solid transparent;
	}
	.call-rows li.sel {
		border-left-color: var(--live);
		background: var(--sunken);
	}
	.call-rows .t {
		color: var(--ink-3);
	}
	.call-rows .c {
		color: var(--ink);
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.call-rows .r {
		color: var(--ink-2);
	}
	.call-rows li.bad .r {
		color: var(--err);
	}
	.call-rows li.speech b {
		color: var(--ink-2);
		font-weight: 500;
	}
	.log-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--line);
		font-size: 15px;
	}
	.rows {
		overflow-y: auto;
		margin: 0;
		padding: 4px 0;
		list-style: none;
		font-family: var(--mono);
		font-size: 13px;
		line-height: 22px;
	}
	.rows li {
		display: grid;
		grid-template-columns: 70px 120px minmax(0, 1fr);
		gap: 12px;
		padding: 2px 16px 2px 13px;
		border-left: 3px solid transparent;
	}
	.rows li.sel {
		border-left-color: var(--live);
		background: var(--sunken);
	}
	.rows .t {
		color: var(--ink-3);
	}
	.rows .w {
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rows .x {
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rows li.you .w,
	.rows li.you .x {
		color: var(--blue);
	}
	.log-empty {
		padding: 16px;
		color: var(--ink-3);
		font-size: 14px;
	}
	.d-foot {
		flex: none;
		padding: 8px 0 12px;
		font-size: 14px;
		color: var(--ink-3);
		border-top: 1px solid var(--line);
	}

	/* status dot */
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--ink-3);
	}
	.dot.live {
		background: var(--live);
	}
	.dot.work {
		background: var(--blue);
	}
	.dot.err {
		background: var(--err);
	}

	/* map overlays */
	.caption {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 12px;
		background: #18181b;
		color: #f4f4f5;
		border-radius: 10px;
		padding: 10px 14px 12px;
	}
	.caption .who {
		font-size: 14px;
		color: #a1a1aa;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.caption .where {
		color: #71717a;
	}
	.caption .said {
		margin-top: 2px;
		font-size: 17px;
		line-height: 1.4;
	}
	.caption .said.muted {
		color: #a1a1aa;
		font-size: 15px;
	}
	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--live);
	}
	.empty {
		position: absolute;
		inset: auto 12px 12px 12px;
		background: var(--surface);
		border-radius: 10px;
		padding: 12px 14px;
		font-size: 15px;
		color: var(--ink-2);
	}
	.notice {
		border-radius: 10px;
		padding: 10px 12px;
		background: var(--sunken);
		font-size: 14px;
		color: var(--ink-2);
	}
	.notice.err {
		background: var(--err-wash);
		color: var(--err);
		border: 1px solid color-mix(in oklch, var(--err), white 70%);
	}
	.notice .next {
		margin-top: 4px;
		color: var(--ink-2);
	}

	/* 3D follow view */
	.inset {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 280px;
		height: 190px;
		border-radius: 10px;
		overflow: hidden;
		border: 2px solid #ffffff;
		box-shadow: 0 2px 10px rgb(24 24 27 / 0.28);
		background: #ffffff;
		z-index: 3;
		transition:
			width 0.25s ease,
			height 0.25s ease,
			top 0.25s ease,
			right 0.25s ease,
			border-radius 0.25s ease;
	}
	.inset.full {
		top: 0;
		right: 0;
		width: 100%;
		height: 100%;
		border-radius: 0;
		border: 0;
		z-index: 1;
	}
	.inset.cmp {
		top: 48px;
		right: 8px;
		width: 150px;
		height: 110px;
	}
	.inset.cmp.full {
		top: 0;
		right: 0;
		width: 100%;
		height: 100%;
	}
	.inset-wait {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 14px;
		color: var(--ink-2);
		background: #ffffff;
	}
	.inset-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
		background: linear-gradient(rgb(24 24 27 / 0.55), rgb(24 24 27 / 0));
		color: #ffffff;
		font-size: 13px;
		font-weight: 500;
	}
	.inset-who {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.inset-who .where {
		opacity: 0.85;
		font-weight: 400;
	}
	.inset-btns {
		display: inline-flex;
		gap: 6px;
		flex: none;
	}
	.inset.cmp:not(.full) .inset-who {
		display: none;
	}
	.inset.cmp:not(.full) .inset-bar {
		justify-content: flex-end;
	}
	.frame :global(.view3d-open) {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 3;
	}
	.frame :global(.caption) {
		z-index: 4;
	}

	/* compact / 9:16 */
	.m-shell {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.m-head {
		flex: none;
		height: 52px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border-bottom: 1px solid var(--line);
	}
	.m-map {
		flex: 1;
		min-height: 220px;
		margin: 10px 12px 0;
	}
	.m-radio {
		flex: none;
		display: flex;
		justify-content: center;
		padding: 4px 14px 14px;
	}
	.m-map .caption {
		left: 8px;
		right: 8px;
		bottom: 8px;
		padding: 8px 12px 10px;
	}
	.m-map .caption .said {
		font-size: 16px;
	}
	.overlay-top {
		position: absolute;
		top: 8px;
		left: 8px;
		right: 8px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}
	.disclaimer-chip {
		background: rgb(24 24 27 / 0.82);
		color: #e4e4e7;
		font-family: var(--mono);
		font-size: 12px;
		line-height: 16px;
		padding: 5px 8px;
		border-radius: 6px;
		max-width: 60%;
	}
	:global(.map-tabs) {
		height: 32px;
	}
</style>
