/**
 * The moving world behind the map and the 3D view.
 *
 * One contract for every source of movement (scripted lines, push-to-talk replies, the live
 * channel's move_unit tool): { unit, place, action }. Cars and walkers follow the road graph,
 * boats follow the water graph, the helicopter flies straight. Positions live in map space
 * (the 1200 x 900 sheet), so the 2D map and the 3D view read the same numbers.
 */
import type { Place, PlaceId } from './types.js';

export type UnitKind = 'car' | 'boat' | 'jetski' | 'heli' | 'person';
export type Action = 'drive_to' | 'chase' | 'stop' | 'circle' | 'highlight';
export const ACTIONS: readonly Action[] = ['drive_to', 'chase', 'stop', 'circle', 'highlight'];

export interface UnitInfo {
	tag: string;
	label: string;
	kind: UnitKind;
	model: string;
	home: PlaceId;
}

type Pt = [number, number];

/** Land graph: roads that exist on the map. Cars and walkers use it. */
export const LAND_NODES: Record<string, Pt> = {
	cypress_toll: [452, 168],
	e_conch: [452, 240],
	e_300: [458, 300],
	e_380: [460, 380],
	e_causeway: [462, 440],
	orange_grove: [476, 620],
	e_marlin: [470, 760],
	h_conch: [540, 240],
	h_300: [540, 300],
	h_causeway: [540, 440],
	h_tarpon: [540, 620],
	h_marlin: [540, 760],
	m_old: [790, 200],
	m_conch: [790, 240],
	m_causeway: [790, 440],
	m_tarpon: [790, 620],
	m_marlin: [790, 760],
	coral_court: [600, 300],
	c_banyan: [679, 440],
	banyan_park: [679, 418],
	bridge_w: [812, 440],
	palm_causeway: [900, 432],
	bridge_e: [992, 428],
	i_mid: [1001, 430],
	i_north: [978, 64],
	lighthouse_point: [978, 48],
	flamingo_strip: [1007, 560],
	i_south: [1022, 790],
	// the inlet road ends at the island's shore, so the inlet channel has no deck over it
	sandbar_inlet: [1022, 792],
	old_quay: [712, 118],
	mango_heights: [365, 380],
	g1: [150, 402],
	gator_flats: [150, 390],
	g2: [262, 352],
	a_marlin: [255, 760],
	ibis_field: [255, 740],
	c_marlin: [650, 760],
	coquina_row: [650, 756],
	marina_dock: [812, 573],
	marina_spur: [812, 620],
	heron_marina: [775, 573]
};
export const LAND_EDGES: [string, string][] = [
	['cypress_toll', 'e_conch'],
	['e_conch', 'e_300'],
	['e_300', 'e_380'],
	['e_380', 'e_causeway'],
	['e_causeway', 'orange_grove'],
	['orange_grove', 'e_marlin'],
	['e_conch', 'h_conch'],
	['h_conch', 'm_conch'],
	['h_conch', 'h_300'],
	['h_300', 'h_causeway'],
	['h_causeway', 'h_tarpon'],
	['h_tarpon', 'h_marlin'],
	['h_300', 'coral_court'],
	['m_old', 'm_conch'],
	['m_conch', 'm_causeway'],
	['m_causeway', 'm_tarpon'],
	['m_tarpon', 'm_marlin'],
	['e_causeway', 'h_causeway'],
	['h_causeway', 'c_banyan'],
	['c_banyan', 'banyan_park'],
	['c_banyan', 'm_causeway'],
	['m_causeway', 'bridge_w'],
	['bridge_w', 'palm_causeway'],
	['palm_causeway', 'bridge_e'],
	['bridge_e', 'i_mid'],
	['i_mid', 'i_north'],
	['i_north', 'lighthouse_point'],
	['i_mid', 'flamingo_strip'],
	['flamingo_strip', 'i_south'],
	['i_south', 'sandbar_inlet'],
	['m_old', 'old_quay'],
	['e_380', 'mango_heights'],
	['e_300', 'g2'],
	['g2', 'g1'],
	['g1', 'gator_flats'],
	['e_marlin', 'a_marlin'],
	['a_marlin', 'ibis_field'],
	['e_marlin', 'h_marlin'],
	['h_marlin', 'c_marlin'],
	['c_marlin', 'coquina_row'],
	['c_marlin', 'm_marlin'],
	['orange_grove', 'h_tarpon'],
	['h_tarpon', 'm_tarpon'],
	['m_tarpon', 'marina_spur'],
	['marina_spur', 'marina_dock'],
	['marina_dock', 'heron_marina']
];

/** Water graph: the bay, the marina basin, the inlet. Boats and the jet ski use it. */
export const WATER_NODES: Record<string, Pt> = {
	// Every node and loop keeps a hull clear of the seawalls, the low decks (Marina Drive, the dock road)
	// and the bridge piers: 5 m for Marine Two, 2 m for the jet ski (tests/test_water_clearance.py).
	// heron_marina is the jet ski's slip just outside the basin; Marine Two waits at w_mouth.
	heron_marina: [816, 546],
	w_mouth: [826, 540],
	w_mid: [866, 520],
	w_b0: [866, 566],
	w_b1: [862, 612],
	w_b2: [912, 700],
	w_b3: [962, 778],
	w_b4: [996, 820],
	// the inlet: through the middle of the gap between the islands, holding on the ocean side
	w_inlet: [1026, 816],
	sandbar_inlet: [1054, 818],
	w_open: [1090, 826],
	// Palm Causeway: hulls hold in open water south of the bridge, never under its deck, and cross
	// under the arch only through the pier-free channel in the middle of the span (space.ts)
	palm_causeway: [902, 482],
	w_cause_n: [902, 388],
	w_n1: [905, 300],
	w_n2: [930, 180],
	old_quay: [884, 96],
	lighthouse_point: [940, 52],
	flamingo_strip: [971, 570]
};
export const WATER_EDGES: [string, string][] = [
	['heron_marina', 'w_mouth'],
	['w_mouth', 'w_mid'],
	['w_mouth', 'w_b0'],
	['w_b0', 'w_b1'],
	['w_mid', 'palm_causeway'],
	['palm_causeway', 'w_cause_n'],
	['w_cause_n', 'w_n1'],
	['w_n1', 'w_n2'],
	['w_n2', 'old_quay'],
	['w_n2', 'lighthouse_point'],
	['w_b1', 'w_b2'],
	['w_b2', 'w_b3'],
	['w_b3', 'w_b4'],
	['w_b4', 'w_inlet'],
	['w_inlet', 'sandbar_inlet'],
	['sandbar_inlet', 'w_open'],
	['w_mid', 'flamingo_strip'],
	['w_b1', 'flamingo_strip']
];

interface Graph {
	nodes: Record<string, Pt>;
	adj: Record<string, { to: string; d: number }[]>;
}

function graph(nodes: Record<string, Pt>, edges: [string, string][]): Graph {
	const adj: Graph['adj'] = Object.fromEntries(Object.keys(nodes).map((k) => [k, []]));
	for (const [a, b] of edges) {
		const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
		adj[a].push({ to: b, d });
		adj[b].push({ to: a, d });
	}
	return { nodes, adj };
}

const LAND = graph(LAND_NODES, LAND_EDGES);
const WATER = graph(WATER_NODES, WATER_EDGES);

function nearest(g: Graph, p: Pt): string {
	let best = '';
	let bd = Infinity;
	for (const [id, q] of Object.entries(g.nodes)) {
		const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
		if (d < bd) {
			bd = d;
			best = id;
		}
	}
	return best;
}

function dijkstra(g: Graph, from: string, to: string): Pt[] {
	if (from === to) return [g.nodes[from]];
	const dist: Record<string, number> = { [from]: 0 };
	const prev: Record<string, string> = {};
	const open = new Set<string>([from]);
	while (open.size) {
		let cur = '';
		let cd = Infinity;
		for (const id of open) if (dist[id] < cd) ((cd = dist[id]), (cur = id));
		open.delete(cur);
		if (cur === to) break;
		for (const e of g.adj[cur]) {
			const nd = cd + e.d;
			if (nd < (dist[e.to] ?? Infinity)) {
				dist[e.to] = nd;
				prev[e.to] = cur;
				open.add(e.to);
			}
		}
	}
	if (!(to in dist)) return [g.nodes[from], g.nodes[to]];
	const path: Pt[] = [];
	for (let n: string | undefined = to; n; n = prev[n]) path.unshift(g.nodes[n]);
	return path;
}

/**
 * Where a hull loops when told to circle a place: centre and radius in map units, all in open water
 * (tests/test_water_clearance.py checks every point of every loop against the shore, the decks and
 * the bridge). Places with no loop here hold still at their water node instead.
 */
export const WATER_LOOPS: Record<string, [number, number, number]> = {
	palm_causeway: [902, 500, 16],
	flamingo_strip: [950, 606, 16],
	sandbar_inlet: [1094, 846, 16],
	lighthouse_point: [930, 90, 14],
	old_quay: [905, 120, 14]
};

/** Route in map space for one kind of unit. A heli flies a straight line. */
export function planRoute(kind: UnitKind, from: Pt, toPlace: Pt, placeId = ''): Pt[] {
	if (kind === 'heli') return [from, toPlace];
	const wet = kind === 'boat' || kind === 'jetski';
	const g = wet ? WATER : LAND;
	const a = nearest(g, from);
	// a hull goes to the place's own water node (its hold point), not the node nearest the land pin
	let b = wet && placeId in WATER_NODES ? placeId : nearest(g, toPlace);
	// Marine Two is too long for the slips: it waits at the basin mouth
	if (kind === 'boat' && b === 'heron_marina') b = 'w_mouth';
	const path = dijkstra(g, a, b);
	const out: Pt[] = [from];
	for (const p of path) {
		const last = out[out.length - 1];
		if (Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.5) out.push(p);
	}
	return out;
}

// map units per second. One map unit is 0.3 m in the street view, so: car 45 = 13.5 m/s (city
// traffic, about 49 km/h), walker 11 = 3.3 m/s (brisk walk), jet ski 55 = 16.5 m/s, boat 40 = 12 m/s,
// chopper 90 = 27 m/s. A chase is 1.5x, a running walker 20 = 6 m/s.
export const SPEED: Record<UnitKind, number> = { car: 45, boat: 40, jetski: 55, heli: 90, person: 11 };
export const RUN_SPEED = 20;
/** Closer than this (map units) counts as already there. */
export const ARRIVE_R = 20;

export interface UnitSim {
	id: string;
	x: number;
	y: number;
	/** radians, 0 = east, clockwise on screen */
	heading: number;
	place: PlaceId;
	moving: boolean;
	running: boolean;
	action: Action;
	route: Pt[];
	leg: number;
	legT: number;
	circle: { cx: number; cy: number; a: number; r: number } | null;
	/** a free map point to end at (Sky Seven's fly_to a street), instead of the place pin */
	goal: Pt | null;
	/** a unit to tail (Sky Seven's follow) */
	follow: string | null;
	/** the chopper's searchlight */
	light: boolean;
}

/** What Sky Seven was last told to do, for the on-screen chip and report(). */
export interface SkyOrder {
	tool: 'fly_to' | 'circle' | 'follow';
	label: string;
	x: number;
	y: number;
	unit?: string;
	at: number;
}

export interface WorldEvent {
	type: 'move' | 'highlight';
	unit?: string;
	place: PlaceId;
	action: Action;
	at: number;
	/** where it came from: a scripted line, a push-to-talk reply, or the live pilot */
	source: 'script' | 'reply' | 'live';
}

export class World {
	units = $state<Record<string, UnitSim>>({});
	info = $state<Record<string, UnitInfo>>({});
	places = $state<Record<PlaceId, Place>>({});
	focus = $state<string | null>(null);
	/** the place the 3D view says it is heading to, for the inset caption */
	focusPlace = $state<PlaceId | null>(null);
	highlight = $state<{ place: PlaceId; at: number } | null>(null);
	sky = $state<SkyOrder | null>(null);
	private listeners = new Set<(e: WorldEvent) => void>();
	private raf = 0;
	private last = 0;

	init(info: Record<string, UnitInfo>, places: Record<PlaceId, Place>): void {
		this.info = info;
		this.places = places;
		this.reset();
	}

	reset(): void {
		const next: Record<string, UnitSim> = {};
		for (const [id, u] of Object.entries(this.info)) {
			const p = this.places[u.home];
			// boats start on their water node (the marina slip), not on the dock road's end
			const wn = u.kind === 'boat' || u.kind === 'jetski' ? WATER_NODES[u.home] : undefined;
			next[id] = {
				id,
				x: wn ? wn[0] : p.x,
				y: wn ? wn[1] : p.y,
				heading: u.kind === 'person' ? Math.PI / 2 : 0,
				place: u.home,
				moving: false,
				running: false,
				action: 'stop',
				route: [],
				leg: 0,
				legT: 0,
				circle: null,
				goal: null,
				follow: null,
				light: false
			};
		}
		this.units = next;
		this.focus = null;
		this.focusPlace = null;
		this.sky = null;
	}

	on(cb: (e: WorldEvent) => void): () => void {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}

	private emit(e: WorldEvent): void {
		for (const cb of this.listeners) cb(e);
	}

	/**
	 * The one entry point. Returns false when the unit, place or action is not one we know.
	 * focus: false moves a unit in the background without taking the camera.
	 */
	move(
		unit: string,
		place: PlaceId,
		action: Action,
		source: WorldEvent['source'] = 'script',
		opts: { focus?: boolean } = {}
	): boolean {
		const u = this.units[unit];
		const info = this.info[unit];
		const dest = this.places[place];
		if (!u || !info || !dest || !ACTIONS.includes(action)) return false;
		const at = performance.now();
		if (action === 'highlight') {
			this.highlight = { place, at };
			this.emit({ type: 'highlight', unit, place, action, at, source });
			return true;
		}
		// "holding at X" from a unit that is not at X yet means it goes there first
		if (action === 'stop' && Math.hypot(u.x - dest.x, u.y - dest.y) > ARRIVE_R) action = 'drive_to';
		if (opts.focus !== false) {
			this.focus = unit;
			this.focusPlace = place;
		}
		if (action === 'stop') {
			u.moving = false;
			u.route = [];
			u.circle = null;
			u.action = 'stop';
			this.emit({ type: 'move', unit, place, action, at, source });
			return true;
		}
		u.action = action;
		u.running = action === 'chase';
		u.circle = null;
		u.goal = null;
		u.follow = null;
		u.place = place;
		if (action === 'circle') {
			// loop around the place once there
			u.route = planRoute(info.kind, [u.x, u.y], [dest.x, dest.y], place);
			u.leg = 0;
			u.legT = 0;
			u.moving = u.route.length > 1;
			if (!u.moving) this.startCircle(u, info, dest);
		} else {
			u.route = planRoute(info.kind, [u.x, u.y], [dest.x, dest.y], place);
			u.leg = 0;
			u.legT = 0;
			u.moving = u.route.length > 1;
		}
		this.emit({ type: 'move', unit, place, action, at, source });
		return true;
	}

	private startCircle(u: UnitSim, info: UnitInfo, dest: { x: number; y: number }): void {
		const wet = info.kind === 'boat' || info.kind === 'jetski';
		if (wet) {
			// hulls loop only where a loop fits in open water; anywhere else they hold at the node
			const loop = WATER_LOOPS[u.place];
			if (!loop) {
				u.moving = false;
				u.running = false;
				return;
			}
			const [cx, cy, r] = loop;
			u.circle = { cx, cy, a: Math.atan2(u.y - cy, u.x - cx), r };
			u.moving = true;
			return;
		}
		const r = info.kind === 'heli' ? 46 : info.kind === 'person' ? 10 : 24;
		u.circle = { cx: dest.x, cy: dest.y, a: Math.atan2(u.y - dest.y, u.x - dest.x), r };
		u.moving = true;
	}

	/**
	 * Sky Seven's tools. fly_to and circle take any map point (a street, not only a story place);
	 * follow tails a unit. Movement starts in this call, so it begins as the pilot confirms.
	 */
	flyTo(unit: string, x: number, y: number, label: string, tool: 'fly_to' | 'circle', source: WorldEvent['source'] = 'live'): boolean {
		const u = this.units[unit];
		const info = this.info[unit];
		if (!u || !info || info.kind !== 'heli') return false;
		const at = performance.now();
		u.follow = null;
		u.circle = null;
		u.goal = [x, y];
		u.action = tool === 'circle' ? 'circle' : 'drive_to';
		u.running = false;
		u.route = planRoute('heli', [u.x, u.y], [x, y]);
		u.leg = 0;
		u.legT = 0;
		u.moving = true;
		if (Math.hypot(u.x - x, u.y - y) < 2) {
			u.route = [];
			if (tool === 'circle') this.startCircle(u, info, { x, y });
			else u.moving = false;
		}
		this.focus = unit;
		this.focusPlace = null;
		this.sky = { tool, label, x, y, at };
		const pid = this.nearestPlace(x, y);
		if (pid) this.emit({ type: 'move', unit, place: pid, action: u.action, at, source });
		return true;
	}

	followUnit(unit: string, target: string, source: WorldEvent['source'] = 'live'): boolean {
		const u = this.units[unit];
		const tu = this.units[target];
		const info = this.info[unit];
		if (!u || !tu || !info || info.kind !== 'heli' || unit === target) return false;
		const at = performance.now();
		u.circle = null;
		u.goal = null;
		u.route = [];
		u.follow = target;
		u.action = 'chase';
		u.moving = true;
		this.focus = unit;
		this.focusPlace = null;
		this.sky = { tool: 'follow', label: this.info[target]?.label ?? target, x: tu.x, y: tu.y, unit: target, at };
		this.emit({ type: 'move', unit, place: tu.place, action: 'chase', at, source });
		return true;
	}

	setLight(unit: string, on: boolean): boolean {
		const u = this.units[unit];
		if (!u) return false;
		u.light = on;
		return true;
	}

	nearestPlace(x: number, y: number): PlaceId | null {
		let best: PlaceId | null = null;
		let bd = Infinity;
		for (const [id, p] of Object.entries(this.places)) {
			const d = Math.hypot(p.x - x, p.y - y);
			if (d < bd) {
				bd = d;
				best = id as PlaceId;
			}
		}
		return best;
	}

	/** Seconds the route still needs, for the inset caption. */
	eta(unit: string): number {
		const u = this.units[unit];
		const info = this.info[unit];
		if (!u || !info || !u.moving || u.circle) return 0;
		let d = 0;
		for (let i = u.leg; i < u.route.length - 1; i += 1) {
			const l = Math.hypot(u.route[i + 1][0] - u.route[i][0], u.route[i + 1][1] - u.route[i][1]);
			d += i === u.leg ? l * (1 - u.legT) : l;
		}
		return d / this.speed(u, info);
	}

	private speed(u: UnitSim, info: UnitInfo): number {
		const base = SPEED[info.kind];
		return u.running ? (info.kind === 'person' ? RUN_SPEED : base * 1.5) : base;
	}

	tick(dt: number): void {
		for (const u of Object.values(this.units)) {
			const info = this.info[u.id];
			if (!info) continue;
			if (u.circle) {
				const c = u.circle;
				const w = (this.speed(u, info) * 0.8) / c.r;
				c.a += w * dt;
				const nx = c.cx + Math.cos(c.a) * c.r;
				const ny = c.cy + Math.sin(c.a) * c.r;
				u.heading = Math.atan2(ny - u.y, nx - u.x);
				u.x = nx;
				u.y = ny;
				continue;
			}
			if (u.follow) {
				this.tickFollow(u, info, dt);
				continue;
			}
			if (!u.moving) continue;
			let left = this.speed(u, info) * dt;
			while (left > 0 && u.leg < u.route.length - 1) {
				const a = u.route[u.leg];
				const b = u.route[u.leg + 1];
				const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.001;
				const remain = len * (1 - u.legT);
				const step = Math.min(left, remain);
				u.legT += step / len;
				left -= step;
				u.x = a[0] + (b[0] - a[0]) * u.legT;
				u.y = a[1] + (b[1] - a[1]) * u.legT;
				u.heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
				if (u.legT >= 0.9999) {
					u.leg += 1;
					u.legT = 0;
				}
			}
			if (u.leg >= u.route.length - 1) {
				const dest = u.goal ? { x: u.goal[0], y: u.goal[1] } : this.places[u.place];
				if (u.action === 'circle' && dest) this.startCircle(u, info, dest);
				else {
					u.moving = false;
					u.running = false;
				}
			}
		}
	}

	/** The chopper tails a unit: it closes in at up to 1.3x its speed and sits just behind it. */
	private tickFollow(u: UnitSim, info: UnitInfo, dt: number): void {
		const t = this.units[u.follow ?? ''];
		if (!t) {
			u.follow = null;
			u.moving = false;
			return;
		}
		const back = 14;
		const gx = t.x - Math.cos(t.heading) * back;
		const gy = t.y - Math.sin(t.heading) * back;
		const dx = gx - u.x;
		const dy = gy - u.y;
		const d = Math.hypot(dx, dy);
		const step = Math.min(d, SPEED[info.kind] * 1.3 * dt);
		if (d > 0.01) {
			u.x += (dx / d) * step;
			u.y += (dy / d) * step;
		}
		u.heading = d > 3 ? Math.atan2(dy, dx) : t.heading;
		u.moving = true;
		if (this.sky?.tool === 'follow') {
			this.sky.x = t.x;
			this.sky.y = t.y;
		}
	}

	start(): void {
		if (this.raf) return;
		this.last = performance.now();
		const loop = (t: number) => {
			const dt = Math.min(0.1, (t - this.last) / 1000);
			this.last = t;
			this.tick(dt);
			this.raf = requestAnimationFrame(loop);
		};
		this.raf = requestAnimationFrame(loop);
	}

	stop(): void {
		cancelAnimationFrame(this.raf);
		this.raf = 0;
	}
}
