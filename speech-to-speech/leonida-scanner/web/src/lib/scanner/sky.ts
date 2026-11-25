/**
 * Sky Seven's tool words, browser side. The twin of sky.py (same table, same steps), so a name the
 * pilot hears resolves the same way in the tests and in the page. Pure: no imports, no DOM, so
 * tests/test_sky.py runs it under plain node and compares it with Python, case by case.
 */

export interface SkyTableLike {
	match: number;
	suggest: number;
	filler: string[];
	suffix: Record<string, string>;
	spots: Record<string, { name: string; x: number; y: number; kind: string; keys: string[] }>;
	units: Record<string, { name: string; keys: string[] }>;
}

export type SkyTool = 'fly_to' | 'follow' | 'circle' | 'spotlight' | 'report';
export const SKY_TOOLS: readonly SkyTool[] = ['fly_to', 'follow', 'circle', 'spotlight', 'report'];

export type Resolved =
	| { ok: true; id: string; name: string; x?: number; y?: number }
	| { ok: false; heard: string; error: string; suggest: string; suggest_id: string };

export type Meaning = ({ tool: string } & Resolved) | { tool: string; ok: true; on: boolean } | { tool: string; ok: true } | { tool: string; ok: false; error: string };

export class Sky {
	private t: SkyTableLike;
	private filler: Set<string>;
	private suffixes: Set<string>;
	constructor(t: SkyTableLike) {
		this.t = t;
		this.filler = new Set(t.filler);
		this.suffixes = new Set(Object.values(t.suffix));
	}

	norm(text: string): string {
		const s = String(text).toLowerCase().replace(/_/g, ' ').replace(/[^a-z0-9 ]+/g, ' ');
		return s
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => this.t.suffix[w] ?? w)
			.join(' ');
	}

	core(text: string): string {
		return this.norm(text)
			.split(' ')
			.filter((w) => w && !this.filler.has(w))
			.join(' ');
	}

	private score(heard: string, key: string): number {
		if (heard === key) return 1;
		const hw = heard.split(' ');
		const kw = key.split(' ');
		if (kw.length && within(hw, kw)) {
			const extra = hw.filter((w) => !kw.includes(w));
			if (!extra.some((w) => this.suffixes.has(w))) return 0.95;
		}
		return ratio(heard, key);
	}

	private best(heard: string, table: Record<string, { keys: string[] }>): [string, number] {
		const h = this.core(heard);
		if (!h) return ['', 0];
		let best = '';
		let score = 0;
		for (const [id, v] of Object.entries(table))
			for (const k of v.keys) {
				const s = this.score(h, k);
				if (s > score + 1e-9) {
					best = id;
					score = s;
				}
			}
		return [best, score];
	}

	nearestSpot(x: number, y: number, skip = ''): string {
		let best = '';
		let bd = Infinity;
		for (const [id, s] of Object.entries(this.t.spots)) {
			if (id === skip) continue;
			const d = (s.x - x) ** 2 + (s.y - y) ** 2;
			if (d < bd) {
				best = id;
				bd = d;
			}
		}
		return best;
	}

	resolvePlace(heard: string, near: [number, number] | null = null): Resolved {
		const [id, score] = this.best(heard, this.t.spots);
		if (id && score >= this.t.match) {
			const s = this.t.spots[id];
			return { ok: true, id, name: s.name, x: s.x, y: s.y };
		}
		const suggest = id && score >= this.t.suggest ? id : near ? this.nearestSpot(near[0], near[1]) : 'palm_causeway';
		return { ok: false, heard: String(heard).slice(0, 60), error: 'unknown place', suggest: this.t.spots[suggest].name, suggest_id: suggest };
	}

	resolveUnit(heard: string): Resolved {
		const [id, score] = this.best(heard, this.t.units);
		if (id && score >= this.t.match) return { ok: true, id, name: this.t.units[id].name };
		return { ok: false, heard: String(heard).slice(0, 60), error: 'unknown unit', suggest: 'The jet ski', suggest_id: 'jet_ski' };
	}

	/** What a tool call means, before anything moves. Same output as sky.dispatch in Python. */
	meaning(name: string, args: unknown, near: [number, number] | null = null): Meaning {
		const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>;
		if (name === 'fly_to' || name === 'circle') return { tool: name, ...this.resolvePlace(String(a.place ?? ''), near) };
		if (name === 'follow') return { tool: name, ...this.resolveUnit(String(a.unit ?? '')) };
		if (name === 'spotlight') {
			const v = a.on ?? true;
			const on = typeof v === 'boolean' ? v : !['false', 'off', '0', 'no'].includes(String(v).trim().toLowerCase());
			return { tool: name, ok: true, on };
		}
		if (name === 'report') return { tool: name, ok: true };
		return { tool: name, ok: false, error: 'unknown tool' };
	}

	/** The pilot said he is moving, and no tool fired: the call he meant, or null. */
	intentFromSpeech(text: string): { tool: SkyTool; args: Record<string, unknown> } | null {
		const t = String(text)
			.toLowerCase()
			.replace(/[^a-z0-9' ,.;!?]+/g, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.join(' ');
		let m = FOLLOW.exec(t);
		if (m?.groups) {
			const r = this.resolveUnit(clip(m.groups.who));
			if (r.ok) return { tool: 'follow', args: { unit: r.id } };
		}
		m = CIRCLE.exec(t);
		if (m?.groups) {
			const r = this.resolvePlace(clip(m.groups.to));
			if (r.ok) return { tool: 'circle', args: { place: r.id } };
		}
		for (const mm of t.matchAll(MOVE)) {
			const r = this.resolvePlace(clip(mm.groups?.to ?? ''));
			if (r.ok) return { tool: 'fly_to', args: { place: r.id } };
		}
		if (LIGHT_OFF.test(t)) return { tool: 'spotlight', args: { on: false } };
		if (LIGHT_ON.test(t)) return { tool: 'spotlight', args: { on: true } };
		return null;
	}
}

const MOVE = new RegExp(
	String.raw`\b(?:heading|headed|head|going|flying|fly|swinging|swing|moving|turning|banking|bringing (?:her|it|us)|on (?:my|our) way|taking (?:her|us|it))\b` +
		String.raw`(?:\s+(?:over|to|toward|towards|for|down to|up to|out to|across to|back to|over to|on to|onto|above))?\s+(?<to>[a-z0-9' ]{3,40})`,
	'g'
);
const CIRCLE = /\b(?:circling|circle|orbiting|orbit|looping|loop)\s+(?:over|around|above)?\s*(?<to>[a-z0-9' ]{3,40})/;
const FOLLOW = /\b(?:following|follow|tailing|tail|tracking|track|staying on|on the tail of|chasing|after)\s+(?<who>[a-z0-9' ]{3,40})/;
const LIGHT_ON = /\b(?:spotlight|searchlight|light) (?:is )?on\b|\blights? (?:it|him|her|them) up\b|\bhitting (?:the|my) (?:spot|search)light\b/;
const LIGHT_OFF = /\b(?:spotlight|searchlight|light) (?:is )?off\b|\bkilling the (?:spot|search)?light\b/;

function clip(fragment: string): string {
	return fragment.split(/\b(?:now|then|and|but|so|because|right|hang|stand|over and out|copy|roger)\b|[,.;!?]/)[0].trim();
}

function within(hw: string[], kw: string[]): boolean {
	const n = kw.length;
	for (let i = 0; i + n <= hw.length; i += 1) if (kw.every((w, j) => hw[i + j] === w)) return true;
	return false;
}

/** difflib.SequenceMatcher(None, a, b).ratio(), for strings under 200 characters (no autojunk). */
export function ratio(a: string, b: string): number {
	const t = a.length + b.length;
	if (!t) return 1;
	const b2j = new Map<string, number[]>();
	for (let j = 0; j < b.length; j += 1) {
		const l = b2j.get(b[j]);
		if (l) l.push(j);
		else b2j.set(b[j], [j]);
	}
	const longest = (alo: number, ahi: number, blo: number, bhi: number): [number, number, number] => {
		let bi = alo;
		let bj = blo;
		let size = 0;
		let j2len = new Map<number, number>();
		for (let i = alo; i < ahi; i += 1) {
			const next = new Map<number, number>();
			for (const j of b2j.get(a[i]) ?? []) {
				if (j < blo) continue;
				if (j >= bhi) break;
				const k = (j2len.get(j - 1) ?? 0) + 1;
				next.set(j, k);
				if (k > size) {
					bi = i - k + 1;
					bj = j - k + 1;
					size = k;
				}
			}
			j2len = next;
		}
		return [bi, bj, size];
	};
	let matches = 0;
	const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]];
	while (queue.length) {
		const [alo, ahi, blo, bhi] = queue.pop()!;
		const [i, j, k] = longest(alo, ahi, blo, bhi);
		if (!k) continue;
		matches += k;
		if (alo < i && blo < j) queue.push([alo, i, blo, j]);
		if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
	}
	return (2 * matches) / t;
}
