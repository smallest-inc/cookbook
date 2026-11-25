/**
 * Channel 6's tools, run in the browser. Hydra calls fly_to, follow, circle, spotlight or report
 * with the words it heard; this resolves them against the map (sky.ts, the twin of sky.py) and
 * moves Sky Seven at once, so the chopper turns while the pilot is still saying "copy".
 * The same entry point takes the pilot's own words when he says he is moving and no tool fired.
 */
import { Sky, type SkyTableLike } from './sky.js';
import type { World } from './world.svelte.js';
import type { PlaceId } from './types.js';

export const HELI = 'sky_seven';

export interface PilotHost {
	world: World;
	onHighlight(place: PlaceId): void;
}

export type ToolResult = Record<string, unknown> & { ok: boolean };

export class Pilot {
	readonly sky: Sky;
	private spots: SkyTableLike['spots'];
	constructor(
		table: SkyTableLike,
		private host: PilotHost
	) {
		this.sky = new Sky(table);
		this.spots = table.spots;
	}

	private heliAt(): [number, number] | null {
		const u = this.host.world.units[HELI];
		return u ? [u.x, u.y] : null;
	}

	private nearName(x: number, y: number): string {
		const id = this.sky.nearestSpot(x, y);
		return this.spots[id]?.name ?? '';
	}

	run(name: string, args: unknown): ToolResult {
		const world = this.host.world;
		const heli = world.units[HELI];
		if (!heli) return { ok: false, error: 'no chopper' };
		const m = this.sky.meaning(name, args, this.heliAt()) as Record<string, unknown> & { ok: boolean };
		if (!m.ok) return m;
		if (name === 'fly_to' || name === 'circle') {
			const x = Number(m.x);
			const y = Number(m.y);
			world.flyTo(HELI, x, y, String(m.name), name);
			const pid = world.nearestPlace(x, y);
			if (pid) this.host.onHighlight(pid);
			const eta = Math.round(world.eta(HELI));
			return { ok: true, place: m.name, eta_s: eta, action: name === 'circle' ? 'circling' : 'heading to' };
		}
		if (name === 'follow') {
			const id = String(m.id);
			if (!world.followUnit(HELI, id)) return { ok: false, error: 'cannot follow that', suggest: 'The jet ski' };
			const t = world.units[id];
			return { ok: true, unit: m.name, near: t ? this.nearName(t.x, t.y) : '' };
		}
		if (name === 'spotlight') {
			const on = Boolean(m.on);
			world.setLight(HELI, on);
			return { ok: true, spotlight: on ? 'on' : 'off' };
		}
		if (name === 'report') return { ok: true, ...this.report() };
		return { ok: false, error: 'unknown tool' };
	}

	report(): Record<string, unknown> {
		const world = this.host.world;
		const u = world.units[HELI];
		if (!u) return {};
		const below: string[] = [];
		for (const [id, o] of Object.entries(world.units)) {
			if (id === HELI) continue;
			if (Math.hypot(o.x - u.x, o.y - u.y) < 140) below.push(world.info[id]?.label ?? id);
		}
		const order = world.sky;
		return {
			over: this.nearName(u.x, u.y),
			heading_to: order && u.moving && order.tool !== 'follow' ? order.label : '',
			following: u.follow ? (world.info[u.follow]?.label ?? u.follow) : '',
			spotlight: u.light ? 'on' : 'off',
			below: below.slice(0, 5)
		};
	}

	/**
	 * The pilot said where he is going, but no tool fired for it: act on his words. Returns the order
	 * it ran, or null. Skips anything that matches the order already running.
	 */
	fromSpeech(text: string): { tool: string; target: string } | null {
		const intent = this.sky.intentFromSpeech(text);
		if (!intent) return null;
		const order = this.host.world.sky;
		const u = this.host.world.units[HELI];
		const target = String(intent.args.place ?? intent.args.unit ?? '');
		if (intent.tool === 'spotlight') {
			if (u && u.light === intent.args.on) return null;
		} else if (order && u) {
			const same =
				(intent.tool === 'follow' && u.follow === target) ||
				(intent.tool !== 'follow' && order.tool === intent.tool && this.spots[target]?.name === order.label);
			if (same) return null;
		}
		const r = this.run(intent.tool, intent.args);
		return r.ok ? { tool: intent.tool, target } : null;
	}
}
