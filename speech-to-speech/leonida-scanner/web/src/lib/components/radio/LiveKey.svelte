<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Scanner } from '#lib/scanner/scanner.svelte.js';

	let { scanner }: { scanner: Scanner } = $props();

	const KEY_URL = 'https://app.smallest.ai/?utm_source=leonida-scanner&utm_medium=app&utm_campaign=channel6';

	let value = $state('');
	let bad = $state(false);
	let form = $state<HTMLFormElement | null>(null);

	// When the box appears, bring it into view without taking focus (arrows and Space stay radio controls).
	$effect(() => {
		if (scanner.live.state === 'needkey' && form) form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		bad = !scanner.useLiveKey(value);
		if (!bad) value = '';
	}
</script>

{#if scanner.live.state === 'needkey'}
	<form class="livekey" bind:this={form} onsubmit={submit} autocomplete="off">
		<p class="lead">Channel 6 is a live AI pilot on Smallest Hydra, running on your own Smallest key.</p>
		{#if scanner.live.notice}<p class="warn" role="alert">{scanner.live.notice}</p>{/if}
		<div class="row">
			<input
				type="password"
				name="smallest-key"
				placeholder="Paste your API key"
				aria-label="Your Smallest API key"
				aria-invalid={bad}
				autocomplete="off"
				spellcheck="false"
				bind:value
				oninput={() => (bad = false)}
			/>
			<Button type="submit" size="sm" class="h-9 px-3" disabled={!value.trim()}>Call Sky Seven</Button>
		</div>
		{#if bad}<p class="warn" role="alert">That does not look like a key. Copy it again from the dashboard.</p>{/if}
		<p class="fine">
			No key? <a href={KEY_URL} target="_blank" rel="noopener noreferrer">Get one free at smallest.ai</a>. It stays in this tab and goes
			straight to Smallest, never to this site. Calls last up to 5 minutes.
		</p>
	</form>
{:else if scanner.live.byok && scanner.live.hasKey}
	<p class="using">
		Channel 6 is using your Smallest key.
		<button type="button" class="forget" onclick={() => scanner.forgetLiveKey()}>Forget it</button>
	</p>
{/if}

<style>
	.livekey {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 0;
		gap: 8px;
		border-radius: 10px;
		padding: 12px;
		background: var(--sunken);
		font-size: 14px;
		color: var(--ink-2);
	}
	.lead {
		color: var(--ink);
	}
	.row {
		display: flex;
		gap: 8px;
		min-width: 0;
	}
	input {
		flex: 1;
		min-width: 0;
		height: 36px;
		border-radius: 8px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		padding: 0 10px;
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink);
	}
	input:focus-visible {
		outline: 2px solid var(--blue);
		outline-offset: 1px;
	}
	input[aria-invalid='true'] {
		border-color: var(--err);
	}
	.warn {
		color: var(--err);
	}
	.fine {
		font-size: 13px;
		color: var(--ink-3);
	}
	a,
	.forget {
		color: var(--blue);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.using {
		font-size: 13px;
		color: var(--ink-3);
	}
	.forget {
		margin-left: 4px;
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		cursor: pointer;
	}
</style>
