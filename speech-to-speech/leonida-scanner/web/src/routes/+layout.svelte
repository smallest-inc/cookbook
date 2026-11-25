<script lang="ts">
	import './layout.css';
	import { Tooltip } from 'bits-ui';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>Leonida Scanner</title>
	<meta name="description" content="A fan-made walkie-talkie scanner for a fictional city. Not affiliated with Rockstar Games." />
</svelte:head>

<Tooltip.Provider>
	{@render children()}
</Tooltip.Provider>
