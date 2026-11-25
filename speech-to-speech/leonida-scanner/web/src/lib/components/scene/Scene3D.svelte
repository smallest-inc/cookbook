<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
	import type { World } from '#lib/scanner/world.svelte.js';
	import StreetScene from './StreetScene.svelte';
	import ChaseHud from './ChaseHud.svelte';
	import type { Quality } from './street/city';

	let { world, expanded = false }: { world: World; expanded?: boolean } = $props();

	// phones and small machines get the light version: no shadows, smaller sky, fewer props
	const quality: Quality = (() => {
		if (typeof window === 'undefined') return 'low';
		const q = new URLSearchParams(location.search).get('q3d');
		if (q === 'high' || q === 'low') return q;
		const small = window.matchMedia('(max-width: 1023px)').matches;
		const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
		return small || weak ? 'low' : 'high';
	})();
	const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, quality === 'low' ? 1.25 : 1.5);
</script>

<div class="scene" aria-hidden="true">
	<Canvas {dpr} shadows={quality === 'high' ? PCFSoftShadowMap : false} toneMapping={ACESFilmicToneMapping}>
		<StreetScene {world} {expanded} {quality} />
	</Canvas>
	{#if expanded}
		<ChaseHud {world} size={quality === 'low' ? 92 : 156} />
	{/if}
</div>

<style>
	.scene {
		position: absolute;
		inset: 0;
		background: #d3d8e0;
	}
	.scene :global(canvas) {
		display: block;
	}
</style>
