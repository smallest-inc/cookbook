<script lang="ts">
	import * as g from './geometry';
	import type { Channel, Marker, Place, PlaceId, Transmission } from '#lib/scanner/types.js';

	let {
		places,
		channel,
		markers,
		current,
		lastPlace,
		playerPlace,
		mode,
		txing,
		on,
		bottomPad = 0,
		followWidth = 560
	}: {
		places: Record<PlaceId, Place>;
		channel: Channel | null;
		markers: Marker[];
		current: Transmission | null;
		lastPlace: PlaceId | null;
		playerPlace: PlaceId;
		mode: 'city' | 'follow';
		txing: boolean;
		on: boolean;
		/** screen pixels at the bottom covered by the caption; the map keeps its subject above it */
		bottomPad?: number;
		/** map units across the frame in follow mode */
		followWidth?: number;
	} = $props();

	let frameW = $state(800);
	let frameH = $state(500);
	let vb = $state({ x: 0, y: 0, w: g.W, h: g.H });
	let raf = 0;

	const player = $derived(places[playerPlace]);
	const activePlace = $derived(current?.place ? places[current.place] : null);
	const routeD = $derived.by(() => {
		const pts = channel?.route ?? [];
		if (pts.length < 2) return '';
		// smooth through the points (Catmull-Rom to cubic Bezier)
		let d = `M${pts[0][0]},${pts[0][1]}`;
		for (let i = 0; i < pts.length - 1; i += 1) {
			const p0 = pts[Math.max(0, i - 1)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(pts.length - 1, i + 2)];
			const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
			const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
			d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
		}
		return d;
	});
	const routeEnd = $derived(channel?.route?.length ? channel.route[channel.route.length - 1] : null);

	interface UnitView {
		id: string;
		label: string;
		short: string;
		x: number;
		y: number;
		mobile: boolean;
		active: boolean;
	}
	// Markers that sit on the exact same spot fan out a little so every tag stays readable.
	const units = $derived.by<UnitView[]>(() => {
		const seen: Record<string, number> = {};
		return markers.map((m) => {
			const key = `${Math.round(m.x / 6)}:${Math.round(m.y / 6)}`;
			const n = (seen[key] = (seen[key] ?? -1) + 1);
			const a = n * 2.1 + 0.6;
			const off = n === 0 ? 0 : 20;
			return {
				id: m.id,
				label: m.label,
				short: m.short,
				x: m.x + Math.cos(a) * off,
				y: m.y + Math.sin(a) * off,
				mobile: m.mobile,
				active: m.active
			};
		});
	});

	// Follow mode frames the place being talked about, and the talker too when both fit.
	const focus = $derived.by(() => {
		const placeId = current?.place ?? lastPlace ?? playerPlace;
		const p = places[placeId] ?? player;
		const talker = units.find((u) => u.active);
		if (!p || !talker) return p;
		const dist = Math.hypot(talker.x - p.x, talker.y - p.y);
		if (dist > followWidth * 0.6) return p;
		return { name: p.name, x: (talker.x + p.x) / 2, y: (talker.y + p.y) / 2 };
	});

	function target() {
		const usableH = Math.max(1, frameH - bottomPad);
		const aspect = frameW / usableH;
		let x: number, y: number, w: number, h: number;
		if (mode === 'city') {
			// contain the city core (a little tighter than the full sheet) above the caption
			const bx = 70, by = 10, bw = 1060, bh = 870;
			w = bw;
			h = w / aspect;
			if (h < bh) {
				h = bh;
				w = h * aspect;
			}
			x = bx + bw / 2 - w / 2;
			y = by + bh / 2 - h / 2;
		} else {
			w = followWidth;
			h = w / aspect;
			x = (focus?.x ?? g.W / 2) - w / 2;
			y = (focus?.y ?? g.H / 2) - h / 2;
		}
		// extend the box downward to cover the caption strip
		const extra = (h / usableH) * bottomPad;
		return { x, y, w, h: h + extra };
	}

	$effect(() => {
		const to = target();
		const from = { ...vb };
		const t0 = performance.now();
		const dur = 700;
		cancelAnimationFrame(raf);
		const ease = (t: number) => 1 - Math.pow(1 - t, 4);
		const stepFn = () => {
			const t = Math.min(1, (performance.now() - t0) / dur);
			const k = ease(t);
			vb = {
				x: from.x + (to.x - from.x) * k,
				y: from.y + (to.y - from.y) * k,
				w: from.w + (to.w - from.w) * k,
				h: from.h + (to.h - from.h) * k
			};
			if (t < 1) raf = requestAnimationFrame(stepFn);
		};
		raf = requestAnimationFrame(stepFn);
		return () => cancelAnimationFrame(raf);
	});

	// labels keep a steady on-screen size in both modes
	const k = $derived(vb.w / Math.max(1, frameW));
	const zoomed = $derived(k < 1.05);
</script>

<div class="map" bind:clientWidth={frameW} bind:clientHeight={frameH}>
	<svg
		viewBox="{vb.x} {vb.y} {vb.w} {vb.h}"
		preserveAspectRatio="xMidYMid slice"
		role="img"
		aria-label="Map of Port Ibis, a fictional city, with units on the current channel"
	>
		<defs>
			<pattern id="marsh" width="14" height="10" patternUnits="userSpaceOnUse">
				<path d="M2,8 l3,-5 M7,8 l0,-6 M11,8 l-3,-5" class="marsh-mark" />
			</pattern>
		</defs>

		<!-- water and land -->
		<rect x="-600" y="-500" width="2400" height="1900" class="bay" />
		<path d={g.ocean} class="ocean" />
		<path d={g.mainland} class="land" />
		<path d={g.swamp} class="swamp" />
		<path d={g.swamp} fill="url(#marsh)" />
		{#each g.swampChannels as d (d)}<path {d} class="channel" />{/each}
		{#each g.ponds as [cx, cy, rx, ry] (cx)}<ellipse {cx} {cy} {rx} {ry} class="pond" />{/each}
		<path d={g.river} class="river" />
		<path d={g.marinaBasin} class="bay" />
		{#each g.marinaPiers as [x, y, w] (y)}<rect {x} {y} width={w} height="3" class="pier" />{/each}
		<path d={g.islandNorth} class="land" />
		<path d={g.islandSouth} class="land" />
		<path d={g.beachNorth} class="beach" />
		<path d={g.beachSouth} class="beach" />

		<!-- districts -->
		<rect {...g.quayArea} rx="4" class="paved" />
		{#each g.containers as b (b.x + '-' + b.y)}
			<rect x={b.x} y={b.y} width={b.w} height={b.h} class="box k{b.k % 3}" />
		{/each}
		{#each g.quayPiers as [x, y, w] (y)}<rect {x} {y} width={w} height="10" class="paved" />{/each}
		{#each g.groves as d (d.x + '-' + d.y)}<circle cx={d.x} cy={d.y} r="3.2" class="tree" />{/each}

		<rect x={g.airport.x} y={g.airport.y} width={g.airport.w} height={g.airport.h} rx="6" class="paved" />
		{#each g.runways as r (r.x)}
			<g transform="rotate({r.rot} {r.cx} {r.cy})">
				<rect x={r.x} y={r.y} width={r.w} height={r.h} class="runway" />
				<line x1={r.x + 10} x2={r.x + r.w - 10} y1={r.y + r.h / 2} y2={r.y + r.h / 2} class="runway-mark" />
			</g>
		{/each}
		<rect {...g.terminal} class="tower" />

		<rect {...g.suburbArea} class="street-fill" transform="rotate(-6 364 380)" />
		<g transform="rotate(-6 364 380)">
			{#each g.suburb as b (b.x + '-' + b.y)}<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" class="block" />{/each}
		</g>
		<rect {...g.southArea} class="street-fill" />
		{#each g.south as b (b.x + '-' + b.y)}<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" class="block" />{/each}
		<rect {...g.downtownArea} class="street-fill" />
		{#each g.downtown as b (b.x + '-' + b.y)}
			<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" class={b.k === 0 ? 'tower' : 'block'} />
		{/each}
		<rect {...g.banyanPark} rx="6" class="park" />

		<!-- roads -->
		{#each g.arterials as d (d)}<path {d} class="road" />{/each}
		<path d={g.swampRoad} class="road minor" />
		<path d={g.islandRoad} class="road" />
		<path d={g.causewayLand} class="road major" />
		<path d={g.causewayBridge} class="bridge-edge" />
		<path d={g.causewayBridge} class="road major" />
		<path d={g.expressway} class="expy" />
		<path d={g.expressway} class="expy-center" />
		{#each [[-30, -30], [30, -30], [-30, 30], [30, 30]] as [dx, dy] (dx + ',' + dy)}
			<circle cx={476 + dx} cy={620 + dy} r="22" class="ramp" />
		{/each}
		<rect x="430" y="160" width="44" height="16" rx="2" class="toll" />
		{#each [438, 446, 454, 462] as x (x)}<line x1={x} x2={x} y1="162" y2="174" class="toll-mark" />{/each}
		<circle cx="978" cy="48" r="7" class="lighthouse" />

		<!-- labels -->
		{#each g.districtLabels as l (l.text)}
			<text x={l.x} y={l.y} class="district" style:font-size="{15 * k}px">{l.text}</text>
		{/each}
		{#each g.waterLabels as l (l.text)}
			<text x={l.x} y={l.y} class="water-label" style:font-size="{14 * k}px">{l.text}</text>
		{/each}
		{#if zoomed}
			{#each g.roadLabels as l (l.text)}
				<text x={l.x} y={l.y} transform="rotate({l.rot} {l.x} {l.y})" class="road-label" style:font-size="{12 * k}px"
					>{l.text}</text
				>
			{/each}
		{/if}

		<!-- live layer -->
		{#if on}
			{#if routeD}
				<path d={routeD} class="route" style:stroke-width="{2.5 * k}px" style:stroke-dasharray="{8 * k} {7 * k}" />
				{#if routeEnd}
					<circle cx={routeEnd[0]} cy={routeEnd[1]} r={4 * k} class="route-end" />
				{/if}
			{/if}

			{#if activePlace}
				{#key current?.startedAt}
					<circle cx={activePlace.x} cy={activePlace.y} r={14 * k} class="ping" />
					<circle cx={activePlace.x} cy={activePlace.y} r={14 * k} class="ping late" />
				{/key}
				<circle cx={activePlace.x} cy={activePlace.y} r={7 * k} class="hot" />
			{:else if lastPlace && places[lastPlace]}
				<circle cx={places[lastPlace].x} cy={places[lastPlace].y} r={8 * k} class="last" style:stroke-width="{2 * k}px" />
			{/if}

			{#each units as u (u.id)}
				<g class="unit" class:active={u.active} style:transform="translate({u.x}px, {u.y}px)">
					{#if u.active}
						<circle r={13 * k} class="unit-ring" style:stroke-width="{2.5 * k}px" />
					{/if}
					{#if u.mobile}
						<circle r={7 * k} class="unit-dot" style:stroke-width="{2 * k}px" />
					{:else}
						<rect x={-6.5 * k} y={-6.5 * k} width={13 * k} height={13 * k} rx={2 * k} class="unit-dot" style:stroke-width="{2 * k}px" />
					{/if}
					<g transform="translate({12 * k} {-10 * k})">
						<rect
							x="0"
							y={-11 * k}
							width={(u.short.length * 7.6 + 12) * k}
							height={20 * k}
							rx={4 * k}
							class="tag"
							class:tag-on={u.active}
						/>
						<text x={6 * k} y={3.5 * k} class="tag-text" class:tag-text-on={u.active} style:font-size="{12.5 * k}px"
							>{u.short}</text
						>
					</g>
				</g>
			{/each}

			{#if activePlace}
				{@const name = activePlace.name}
				<g transform="translate({activePlace.x} {activePlace.y + 22 * k})">
					<rect x={-(name.length * 7.4 + 16) * k / 2} y="0" width={(name.length * 7.4 + 16) * k} height={22 * k} rx={5 * k} class="place-chip" />
					<text x="0" y={15 * k} class="place-text" style:font-size="{13 * k}px">{name}</text>
				</g>
			{/if}
		{/if}

		{#if player}
			<g style:transform="translate({player.x + 26}px, {player.y + 30}px)">
				{#if txing}
					<circle r={12 * k} class="ping" />
					<circle r={12 * k} class="ping late" />
				{/if}
				<path
					d="M0,{-11 * k} L{8 * k},{9 * k} L0,{4.5 * k} L{-8 * k},{9 * k} Z"
					class="player"
					style:stroke-width="{2 * k}px"
				/>
				<text x={13 * k} y={5 * k} class="player-text" style:font-size="{13 * k}px">You</text>
			</g>
		{/if}
	</svg>
</div>

<style>
	.map {
		position: absolute;
		inset: 0;
		background: #18252c;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
		font-family: var(--sans);
	}
	.bay {
		fill: #1b2a32;
	}
	.ocean {
		fill: #15222a;
	}
	.land {
		fill: #272b27;
	}
	.swamp {
		fill: #252d25;
	}
	.marsh-mark {
		stroke: #34412f;
		stroke-width: 1.2;
		fill: none;
		stroke-linecap: round;
	}
	.channel {
		fill: none;
		stroke: #1d2c31;
		stroke-width: 6;
		stroke-linecap: round;
	}
	.pond {
		fill: #1d2c31;
	}
	.river {
		fill: none;
		stroke: #1b2a32;
		stroke-width: 13;
		stroke-linecap: round;
	}
	.pier {
		fill: #4a4a43;
	}
	.beach {
		fill: none;
		stroke: #615a45;
		stroke-width: 7;
		stroke-linecap: round;
	}
	.paved {
		fill: #30342f;
	}
	.box.k0 {
		fill: #4b3f36;
	}
	.box.k1 {
		fill: #35444a;
	}
	.box.k2 {
		fill: #45443b;
	}
	.tree {
		fill: #2f3d2c;
	}
	.runway {
		fill: #41453f;
	}
	.runway-mark {
		stroke: #8b887c;
		stroke-width: 1.5;
		stroke-dasharray: 10 8;
	}
	.street-fill {
		fill: #3a3e38;
	}
	.block {
		fill: #2f332e;
	}
	.tower {
		fill: #474b44;
	}
	.park {
		fill: #2c3c2c;
	}
	.road {
		fill: none;
		stroke: #4f534c;
		stroke-width: 6;
		stroke-linecap: round;
	}
	.road.minor {
		stroke-width: 4.5;
		stroke: #484b44;
	}
	.road.major {
		stroke: #6d6d64;
		stroke-width: 8;
	}
	.bridge-edge {
		fill: none;
		stroke: #121a1e;
		stroke-width: 14;
	}
	.expy {
		fill: none;
		stroke: #8d8a7d;
		stroke-width: 12;
	}
	.expy-center {
		fill: none;
		stroke: #2a2e2a;
		stroke-width: 1.6;
	}
	.ramp {
		fill: none;
		stroke: #75736a;
		stroke-width: 5;
	}
	.toll {
		fill: #5c5c54;
	}
	.toll-mark {
		stroke: #272b27;
		stroke-width: 2;
	}
	.lighthouse {
		fill: #e4e4e7;
		stroke: #272b27;
		stroke-width: 3;
	}
	.district {
		fill: #d4d4d8;
		font-weight: 600;
		text-anchor: middle;
		paint-order: stroke;
		stroke: #20241f;
		stroke-width: 3px;
		letter-spacing: -0.01em;
	}
	.water-label {
		fill: #7b929c;
		font-style: italic;
		text-anchor: middle;
	}
	.road-label {
		fill: #a9a597;
		font-family: var(--mono);
		text-anchor: middle;
		paint-order: stroke;
		stroke: #20241f;
		stroke-width: 3px;
	}
	.route {
		fill: none;
		stroke: #ece6d8;
		opacity: 0.55;
		stroke-linecap: round;
	}
	.ping {
		fill: none;
		stroke: var(--live);
		stroke-width: 3;
		transform-box: fill-box;
		transform-origin: center;
		animation: ping 1.6s cubic-bezier(0.25, 1, 0.5, 1) infinite;
	}
	.ping.late {
		animation-delay: 0.8s;
	}
	@keyframes ping {
		from {
			transform: scale(0.6);
			opacity: 1;
		}
		to {
			transform: scale(3.2);
			opacity: 0;
		}
	}
	.hot {
		fill: var(--live);
		stroke: #20241f;
		stroke-width: 2;
	}
	.route-end {
		fill: #ece6d8;
		opacity: 0.7;
	}
	.last {
		fill: none;
		stroke: #ece6d8;
		opacity: 0.6;
	}
	.unit {
		transition: none;
	}
	.unit-dot {
		fill: #f1f3f4;
		stroke: #18181b;
	}
	.unit.active .unit-dot {
		fill: var(--live);
	}
	.unit-ring {
		fill: none;
		stroke: var(--live);
	}
	.tag {
		fill: #18181b;
		stroke: #4a4740;
		stroke-width: 1px;
	}
	.tag-on {
		fill: #f1f3f4;
		stroke: none;
	}
	.tag-text {
		fill: #e9e3d6;
		font-family: var(--mono);
		font-weight: 600;
	}
	.tag-text-on {
		fill: #18181b;
	}
	.place-chip {
		fill: #f1f3f4;
	}
	.place-text {
		fill: #18181b;
		font-weight: 600;
		text-anchor: middle;
	}
	.player {
		fill: #f1f3f4;
		stroke: var(--blue);
		stroke-linejoin: round;
	}
	.player-text {
		fill: #f1f3f4;
		font-weight: 600;
		paint-order: stroke;
		stroke: #20241f;
		stroke-width: 3px;
	}
</style>
