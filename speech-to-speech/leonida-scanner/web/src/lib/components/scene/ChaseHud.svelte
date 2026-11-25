<script lang="ts">
	import { onMount } from 'svelte';
	import type { World } from '#lib/scanner/world.svelte.js';
	import { LAND_EDGES, LAND_NODES } from '#lib/scanner/world.svelte.js';
	import * as g from '../map/geometry';
	import { mainlandNotched } from './street/space';
	import { inSentence } from '#lib/scanner/text.js';

	let { world, size = 156 }: { world: World; size?: number } = $props();

	let mapEl: HTMLCanvasElement | undefined = $state();
	let clock = $state('');

	const focusId = $derived(world.focus && world.units[world.focus] ? world.focus : 'jet_ski');
	const info = $derived(world.info[focusId]);
	const unit = $derived(world.units[focusId]);
	const placeName = $derived(world.focusPlace ? (world.places[world.focusPlace]?.name ?? '') : '');
	const verb = $derived.by(() => {
		const a = unit?.action;
		if (!unit?.moving) return 'holding';
		if (a === 'chase') return 'in pursuit to';
		if (a === 'circle') return 'circling';
		return 'heading to';
	});
	// channel 6: what the live pilot was told to do, for the chip and the card
	const order = $derived(focusId === 'sky_seven' ? world.sky : null);
	const orderText = $derived.by(() => {
		if (!order) return '';
		if (order.tool === 'follow') return `following ${inSentence(order.label)}`;
		if (unit?.moving && !unit.circle) return `heading to ${order.label}`;
		return order.tool === 'circle' ? `circling ${order.label}` : `over ${order.label}`;
	});
	// heat is the scene's own mood meter: what the unit is doing right now
	const heat = $derived(!unit ? 0 : !unit.moving ? 1 : unit.action === 'chase' ? 4 : unit.action === 'circle' ? 3 : 2);

	const paths = {
		land: [mainlandNotched, g.islandNorth, g.islandSouth].map((d) => new Path2D(d)),
		swamp: new Path2D(g.swamp),
		river: new Path2D(g.river),
		park: new Path2D(`M${g.banyanPark.x},${g.banyanPark.y} h${g.banyanPark.w} v${g.banyanPark.h} h${-g.banyanPark.w} Z`)
	};

	onMount(() => {
		let raf = 0;
		let lastT = performance.now();
		let yaw = NaN;
		const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
		const draw = (now: number) => {
			raf = requestAnimationFrame(draw);
			const dt = Math.min(0.1, (now - lastT) / 1000);
			lastT = now;
			clock = fmt.format(new Date());
			const u = world.units[focusId];
			const c = mapEl;
			if (!u || !c) return;
			if (Number.isNaN(yaw)) yaw = u.heading;
			let d = (u.heading - yaw) % (Math.PI * 2);
			if (d > Math.PI) d -= Math.PI * 2;
			if (d < -Math.PI) d += Math.PI * 2;
			yaw += d * Math.min(1, dt * 3);
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const px = Math.round(size * dpr);
			if (c.width !== px) {
				c.width = px;
				c.height = px;
			}
			const ctx = c.getContext('2d');
			if (!ctx) return;
			const R = px / 2;
			const zoom = (px / 260) * 1.0;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, px, px);
			ctx.save();
			ctx.beginPath();
			ctx.arc(R, R, R - 1, 0, Math.PI * 2);
			ctx.clip();
			ctx.fillStyle = '#8ec3d6';
			ctx.fillRect(0, 0, px, px);
			const rot = -Math.PI / 2 - yaw;
			ctx.translate(R, R * 1.12);
			ctx.rotate(rot);
			ctx.scale(zoom, zoom);
			ctx.translate(-u.x, -u.y);
			ctx.fillStyle = '#eceee8';
			for (const p of paths.land) ctx.fill(p);
			ctx.fillStyle = '#d3dcc6';
			ctx.fill(paths.swamp);
			ctx.fillStyle = '#c6dcb6';
			ctx.fill(paths.park);
			ctx.strokeStyle = '#8ec3d6';
			ctx.lineWidth = 16;
			ctx.stroke(paths.river);
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			for (const [w, col] of [
				[13, '#c9ccd1'],
				[9, '#ffffff']
			] as const) {
				ctx.strokeStyle = col;
				ctx.lineWidth = w;
				ctx.beginPath();
				for (const [a, b] of LAND_EDGES) {
					ctx.moveTo(...LAND_NODES[a]);
					ctx.lineTo(...LAND_NODES[b]);
				}
				ctx.stroke();
			}
			// route still to drive
			if (u.moving && u.route.length > u.leg + 1) {
				ctx.strokeStyle = '#2a5fd0';
				ctx.lineWidth = 5;
				ctx.beginPath();
				ctx.moveTo(u.x, u.y);
				for (let i = u.leg + 1; i < u.route.length; i += 1) ctx.lineTo(u.route[i][0], u.route[i][1]);
				ctx.stroke();
			}
			const o = focusId === 'sky_seven' ? world.sky : null;
			const dest = o ? { x: o.x, y: o.y } : world.focusPlace ? world.places[world.focusPlace] : null;
			if (dest) {
				ctx.fillStyle = '#ffffff';
				ctx.strokeStyle = '#2a5fd0';
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(dest.x, dest.y, 9, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			}
			for (const [oid, o] of Object.entries(world.units)) {
				if (oid === focusId) continue;
				ctx.fillStyle = '#3f3f46';
				ctx.beginPath();
				ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
			// player arrow, always pointing up
			ctx.save();
			ctx.translate(R, R * 1.12);
			ctx.fillStyle = '#ffffff';
			ctx.strokeStyle = '#18181b';
			ctx.lineWidth = 2 * dpr;
			const a = 9 * dpr;
			ctx.beginPath();
			ctx.moveTo(0, -a);
			ctx.lineTo(a * 0.72, a * 0.8);
			ctx.lineTo(0, a * 0.4);
			ctx.lineTo(-a * 0.72, a * 0.8);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.restore();
			// north tick on the rim
			const na = rot - Math.PI / 2;
			const nx = R + Math.cos(na) * (R - 12 * dpr);
			const ny = R + Math.sin(na) * (R - 12 * dpr);
			ctx.fillStyle = '#18181b';
			ctx.beginPath();
			ctx.arc(nx, ny, 8 * dpr, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.font = `600 ${10 * dpr}px "Schibsted Grotesk Variable", system-ui, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('N', nx, ny + 0.5);
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="hud">
	{#if order}
		{#key order.at}
			<div class="sky-chip" role="status">Sky 7 {orderText}</div>
		{/key}
	{/if}
	<div class="top">
		<div class="clock num">{clock}</div>
		<div class="heat" aria-label="Heat {heat} of 5">
			<span class="lbl">Heat</span>
			{#each [0, 1, 2, 3, 4] as i (i)}<span class="pip" class:on={i < heat}></span>{/each}
		</div>
		<div class="fan">Fan-made. Not affiliated with Rockstar Games.</div>
	</div>
	<div class="bottom">
		<div class="mini" style:width="{size}px" style:height="{size}px">
			<canvas bind:this={mapEl} style:width="{size}px" style:height="{size}px"></canvas>
		</div>
		{#if info}
			<div class="dispatch">
				<span class="who">{info.label}</span>
				{#if order}
					<span class="what">{orderText}</span>
				{:else}
					<span class="what">{verb}{#if placeName && unit?.moving}&nbsp;{placeName}{/if}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.hud {
		position: absolute;
		inset: 0;
		pointer-events: none;
		font-family: 'Schibsted Grotesk Variable', system-ui, sans-serif;
		color: #ffffff;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.sky-chip {
		position: absolute;
		top: 48px;
		left: 50%;
		transform: translateX(-50%);
		background: #ffffff;
		color: #18181b;
		border-radius: 999px;
		padding: 6px 14px;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
		animation: chip-in 0.35s ease-out;
	}
	@keyframes chip-in {
		from {
			opacity: 0;
			transform: translate(-50%, -6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sky-chip {
			animation: none;
		}
	}
	.top {
		position: absolute;
		top: 48px;
		right: 16px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		text-shadow:
			0 1px 2px rgb(0 0 0 / 0.55),
			0 0 1px rgb(0 0 0 / 0.6);
	}
	.clock {
		font-family: 'Geist Mono Variable', ui-monospace, monospace;
		font-size: 30px;
		line-height: 1;
		font-weight: 500;
		letter-spacing: -0.02em;
	}
	.heat {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 14px;
	}
	.heat .lbl {
		margin-right: 4px;
	}
	.fan {
		max-width: 170px;
		font-family: 'Geist Mono Variable', ui-monospace, monospace;
		font-size: 11px;
		line-height: 14px;
		text-align: right;
		text-shadow: none;
		color: #e4e4e7;
		background: rgb(24 24 27 / 0.72);
		border-radius: 6px;
		padding: 4px 7px;
	}
	.pip {
		width: 12px;
		height: 12px;
		border-radius: 999px;
		border: 2px solid #ffffff;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
	}
	.pip.on {
		background: #ffffff;
	}
	.bottom {
		position: absolute;
		left: 16px;
		bottom: 96px;
		display: flex;
		align-items: flex-end;
		gap: 12px;
	}
	.mini {
		border-radius: 999px;
		border: 4px solid #ffffff;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
		overflow: hidden;
		flex: none;
	}
	.mini canvas {
		display: block;
	}
	.dispatch {
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: #ffffff;
		color: #18181b;
		border-radius: 10px;
		padding: 8px 12px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
		max-width: 260px;
		margin-bottom: 6px;
	}
	.dispatch .who {
		font-size: 14px;
		font-weight: 600;
	}
	.dispatch .what {
		font-size: 14px;
		color: #3f3f46;
	}
	@media (max-width: 640px) {
		.top {
			top: 44px;
			right: 10px;
		}
		.clock {
			font-size: 22px;
		}
		.bottom {
			left: 10px;
			top: 44px;
			bottom: auto;
		}
		.mini {
			border-width: 3px;
		}
		.dispatch {
			display: none;
		}
		.sky-chip {
			top: auto;
			bottom: 96px;
			font-size: 13px;
		}
	}
</style>
