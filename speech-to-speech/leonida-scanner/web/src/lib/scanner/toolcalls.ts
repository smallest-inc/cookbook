/**
 * Channel 6's tool-call panel, as plain text. Pure (no DOM, no Svelte), so tests/js/toolcalls.mjs
 * runs it under node. One entry per order that moved Sky Seven: a Hydra tool call, or the pilot's
 * own words when he said where he was going and no tool fired (marked as speech, never as a tool).
 */

export interface ToolCallEntry {
	id: number;
	via: 'tool' | 'speech';
	name: string;
	args: string;
	result: string;
	ok: boolean;
	clock: string;
}

const MAX_ARGS = 60;
const MAX_RESULT = 90;

function cut(s: string, n: number): string {
	return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Arguments as compact JSON, e.g. {"place":"Ocean Drive"}. */
export function describeArgs(args: unknown): string {
	if (args === undefined || args === null) return '{}';
	try {
		return cut(JSON.stringify(args), MAX_ARGS);
	} catch {
		return '{}';
	}
}

/** The result sent back to Hydra, readable: the error and suggestion on failure, the fields otherwise. */
export function describeResult(result: Record<string, unknown>): string {
	if (!result.ok) {
		const err = String(result.error ?? 'failed');
		const suggest = result.suggest ? `, suggest ${String(result.suggest)}` : '';
		return cut(`${err}${suggest}`, MAX_RESULT);
	}
	const parts = Object.entries(result)
		.filter(([k, v]) => k !== 'ok' && v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
		.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
	return cut(parts.join(' · ') || 'ok', MAX_RESULT);
}

/** m:ss since the session started. */
export function sessionClock(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Newest first, at most `max` entries. */
export function pushCall(list: ToolCallEntry[], entry: ToolCallEntry, max = 8): ToolCallEntry[] {
	return [entry, ...list].slice(0, max);
}
