<script lang="ts">
	/**
	 * A physical-looking rotary knob. Click steps forward (shift-click back), the wheel and
	 * arrow keys step either way, and a vertical drag turns it. Every detent calls `onstep`.
	 */
	let {
		angle,
		size = 64,
		label,
		valueText,
		marks = [],
		disabled = false,
		onstep
	}: {
		angle: number;
		size?: number;
		label: string;
		valueText: string;
		marks?: { angle: number; text: string; active?: boolean }[];
		disabled?: boolean;
		onstep: (delta: number) => void;
	} = $props();

	const ridges = Array.from({ length: 30 }, (_, i) => i * 12);
	let dragY: number | null = null;
	let dragAcc = 0;
	let moved = false;
	let pressed = $state(false);

	const pad = $derived(marks.length ? 22 : 4);
	const box = $derived(size + pad * 2);
	const c = $derived(box / 2);
	const r = $derived(size / 2);

	function pointerdown(e: PointerEvent) {
		if (disabled) return;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		dragY = e.clientY;
		dragAcc = 0;
		moved = false;
		pressed = true;
	}
	function pointermove(e: PointerEvent) {
		if (dragY === null) return;
		dragAcc += dragY - e.clientY;
		dragY = e.clientY;
		while (Math.abs(dragAcc) >= 22) {
			moved = true;
			const d = dragAcc > 0 ? 1 : -1;
			dragAcc -= d * 22;
			onstep(d);
		}
	}
	function pointerup(e: PointerEvent) {
		if (dragY !== null && !moved && !disabled) onstep(e.shiftKey ? -1 : 1);
		dragY = null;
		pressed = false;
	}
	function wheel(e: WheelEvent) {
		if (disabled) return;
		e.preventDefault();
		onstep(e.deltaY < 0 ? 1 : -1);
	}
	function keydown(e: KeyboardEvent) {
		if (disabled) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
			e.preventDefault();
			e.stopPropagation();
			onstep(1);
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
			e.preventDefault();
			e.stopPropagation();
			onstep(-1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			onstep(1);
		}
	}
</script>

<button
	type="button"
	class="knob"
	class:pressed
	style:width="{box}px"
	style:height="{box}px"
	aria-label="{label}: {valueText}. Click or use arrow keys to turn."
	{disabled}
	onpointerdown={pointerdown}
	onpointermove={pointermove}
	onpointerup={pointerup}
	onpointercancel={() => {
		dragY = null;
		pressed = false;
	}}
	onwheel={wheel}
	onkeydown={keydown}
>
	<svg width={box} height={box} viewBox="0 0 {box} {box}" aria-hidden="true">
		{#each marks as m (m.text)}
			{@const a = ((m.angle - 90) * Math.PI) / 180}
			<line
				x1={c + Math.cos(a) * (r + 3)}
				y1={c + Math.sin(a) * (r + 3)}
				x2={c + Math.cos(a) * (r + 7)}
				y2={c + Math.sin(a) * (r + 7)}
				class="tick"
				class:on={m.active}
			/>
			<text x={c + Math.cos(a) * (r + 15)} y={c + Math.sin(a) * (r + 15) + 4} class="mark" class:on={m.active}
				>{m.text}</text
			>
		{/each}
		<circle cx={c} cy={c + 2} r={r} class="base" />
		<g style:transform="rotate({angle}deg)" style:transform-origin="{c}px {c}px" class="rot">
			<circle cx={c} cy={c} r={r} class="skirt" />
			{#each ridges as deg (deg)}
				{@const a = (deg * Math.PI) / 180}
				<line
					x1={c + Math.cos(a) * (r - 1.5)}
					y1={c + Math.sin(a) * (r - 1.5)}
					x2={c + Math.cos(a) * (r - 6)}
					y2={c + Math.sin(a) * (r - 6)}
					class="ridge"
				/>
			{/each}
			<circle cx={c} cy={c} r={r * 0.7} class="cap" />
			<line x1={c} y1={c - r * 0.18} x2={c} y2={c - r * 0.62} class="pointer" />
		</g>
	</svg>
</button>

<style>
	.knob {
		display: block;
		padding: 0;
		border: 0;
		background: none;
		cursor: grab;
		touch-action: none;
		border-radius: 999px;
	}
	.knob:focus-visible {
		outline: 2px solid var(--blue);
		outline-offset: -2px;
	}
	.knob:disabled {
		cursor: default;
	}
	.rot {
		transition: transform 120ms cubic-bezier(0.25, 1, 0.5, 1);
	}
	.base {
		fill: #0f100e;
	}
	.skirt {
		fill: #1c1d1b;
		stroke: #0c0d0b;
		stroke-width: 1;
	}
	.pressed .skirt {
		fill: #181917;
	}
	.ridge {
		stroke: #34352f;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.cap {
		fill: #272825;
		stroke: #3a3b36;
		stroke-width: 1;
	}
	.pointer {
		stroke: #ece6d8;
		stroke-width: 3;
		stroke-linecap: round;
	}
	.tick {
		stroke: #6b6a62;
		stroke-width: 1.5;
	}
	.tick.on {
		stroke: #ece6d8;
	}
	.mark {
		fill: #8d8b81;
		font: 600 12px var(--mono);
		text-anchor: middle;
	}
	.mark.on {
		fill: #ece6d8;
	}
</style>
