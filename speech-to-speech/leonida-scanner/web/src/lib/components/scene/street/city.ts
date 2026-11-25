/**
 * Port Ibis at street level. Built at load from the same map data the 2D map and the sim use:
 * roads are the sim's land graph (so a car always drives on asphalt), land is the map's coastline
 * behind a seawall, the bay is shader water. Buildings, palms and signals are placed along the
 * roads with a seeded random, so the city is the same on every load. All original geometry.
 */
import {
	Color,
	DoubleSide,
	ExtrudeGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	ShapeGeometry,
	type Material,
	type Texture
} from 'three';
import * as g from '../../map/geometry';
import { LAND_EDGES, LAND_NODES } from '#lib/scanner/world.svelte.js';
import { Geo } from './geo';
import { LAND_Y, ROAD_W, S, WALK_W, CX, CY, mainlandNotched, onBridge, onLand, roadY, shapesOf, toW, insideRect, pathPoints, BRIDGE_RISE, BRIDGE_CHANNEL } from './space';
import { asphalt, bark, concrete, decoBay, frond, glassBay, grass, rng, seawall } from './textures';

export type Quality = 'high' | 'low';

type Pt = [number, number];

const PASTEL = ['#f7c1cf', '#a7e3d0', '#a9d4f0', '#fbe7a1', '#ffc9a3', '#f4f1ea', '#d9c8f0', '#f6a9a0', '#bfe6e0', '#f4f1ea', '#ffffff'];
const BRIDGE_NODES = new Set(['bridge_w', 'palm_causeway', 'bridge_e']);

/** Map-space -> world-space matrix for shapes drawn in map units (x, y) and extruded along z in metres. */
const shapeToWorld = (yBase: number) => new Matrix4().set(S, 0, 0, -CX * S, 0, 0, 1, yBase, 0, S, 0, -CY * S, 0, 0, 0, 1);

/** Occupancy grid in world metres, so buildings, roads and palms do not overlap. */
class Grid {
	cell = 2;
	x0 = -260;
	z0 = -200;
	nx = 280;
	nz = 220;
	data = new Uint8Array(this.nx * this.nz);
	/** roof height (world y) per cell, for the chopper to clear */
	h = new Float32Array(this.nx * this.nz);
	idx(x: number, z: number) {
		const i = Math.floor((x - this.x0) / this.cell);
		const j = Math.floor((z - this.z0) / this.cell);
		if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
		return j * this.nx + i;
	}
	get(x: number, z: number) {
		const k = this.idx(x, z);
		return k < 0 ? 1 : this.data[k];
	}
	top(x: number, z: number) {
		const k = this.idx(x, z);
		return k < 0 ? 0 : this.h[k];
	}
	raise(x: number, z: number, y: number) {
		const k = this.idx(x, z);
		if (k >= 0 && y > this.h[k]) this.h[k] = y;
	}
	set(x: number, z: number, v = 1) {
		const k = this.idx(x, z);
		if (k >= 0) this.data[k] = v;
	}
	/** Visit cells of a rotated rectangle. Returns false as soon as the visitor does. */
	rect(cx: number, cz: number, w: number, d: number, rot: number, fn: (x: number, z: number) => boolean): boolean {
		const c = Math.cos(rot);
		const s = Math.sin(rot);
		for (let a = -w / 2; a <= w / 2 + 0.01; a += this.cell * 0.7)
			for (let b = -d / 2; b <= d / 2 + 0.01; b += this.cell * 0.7) {
				if (!fn(cx + a * c + b * s, cz - a * s + b * c)) return false;
			}
		return true;
	}
}

function edgesAt(node: string) {
	return LAND_EDGES.filter(([a, b]) => a === node || b === node);
}

/** Should sidewalks and markings stop short of this node (a junction or a real bend)? */
function isJunction(node: string): boolean {
	const es = edgesAt(node);
	if (es.length >= 3) return true;
	if (es.length < 2) return false;
	const dirs = es.map(([a, b]) => {
		const o = a === node ? b : a;
		const p = LAND_NODES[node];
		const q = LAND_NODES[o];
		const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
		return [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
	});
	const dot = dirs[0][0] * dirs[1][0] + dirs[0][1] * dirs[1][1];
	return dot > -0.85; // not roughly straight through
}

/**
 * What the moving units collide with. Buildings come from the same occupancy grid the city was
 * placed with (cell value 2, with a half-metre margin); poles, lights and palms are circles.
 */
export interface Collide {
	/** inside a building footprint or a prop */
	solid(x: number, z: number, r?: number): boolean;
	/** a low deck over water (a dock road or the low end of the bridge) a hull cannot pass under */
	deck(x: number, z: number): boolean;
	/** highest roof (world y) within r metres */
	roof(x: number, z: number, r: number): number;
}

export interface City {
	group: Group;
	waterMeshes: Mesh[];
	collide: Collide;
	dispose(): void;
}

export function buildCity(quality: Quality, waterMat: Material, env: Texture | null): City {
	const root = new Group();
	const r = rng(42);
	const lo = quality === 'low';
	const owned: { dispose(): void }[] = [];
	const keep = <T extends { dispose(): void }>(x: T) => (owned.push(x), x);

	// ---------- water and land ----------
	const waterMeshes: Mesh[] = [];
	const sea = new Mesh(keep(new PlaneGeometry(6000, 6000)), waterMat);
	sea.rotation.x = -Math.PI / 2;
	sea.position.y = 0;
	root.add(sea);
	waterMeshes.push(sea);

	const grassTex = keep(grass());
	grassTex.repeat.set(1 / 40, 1 / 40);
	const wallTex = keep(seawall());
	wallTex.repeat.set(1 / 24, 1 / 4.6);
	wallTex.offset.set(0, 0);
	const grassMat = keep(new MeshStandardMaterial({ map: grassTex, roughness: 0.95, side: DoubleSide }));
	const wallMat = keep(new MeshStandardMaterial({ map: wallTex, roughness: 0.9, side: DoubleSide }));
	for (const d of [mainlandNotched, g.islandNorth, g.islandSouth]) {
		for (const shape of shapesOf(d)) {
			const geo = keep(new ExtrudeGeometry(shape, { depth: LAND_Y + 3, bevelEnabled: false, curveSegments: 10 }));
			geo.applyMatrix4(shapeToWorld(-3));
			geo.computeVertexNormals();
			const m = new Mesh(geo, [grassMat, wallMat]);
			m.receiveShadow = true;
			root.add(m);
		}
	}

	// paved districts and the airport, as flat overlays on the land
	const pavedTex = keep(concrete('#cfccc5'));
	pavedTex.repeat.set(1 / 20, 1 / 20);
	const pavedMat = keep(new MeshStandardMaterial({ map: pavedTex, roughness: 0.92, side: DoubleSide }));
	const overlay = (d: string, mat: Material, y: number) => {
		for (const shape of shapesOf(d)) {
			const geo = keep(new ShapeGeometry(shape, 8));
			geo.applyMatrix4(new Matrix4().set(S, 0, 0, -CX * S, 0, 0, 0, y, 0, S, 0, -CY * S, 0, 0, 0, 1));
			geo.computeVertexNormals();
			const m = new Mesh(geo, mat);
			m.receiveShadow = true;
			root.add(m);
		}
	};
	const rectPath = (x: number, y: number, w: number, h: number) => `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;
	for (const a of [g.downtownArea, g.southArea, g.quayArea, g.airport]) overlay(rectPath(a.x, a.y, a.w, a.h), pavedMat, LAND_Y + 0.01);
	const swampMat = keep(new MeshStandardMaterial({ color: '#7d8f5a', roughness: 1, side: DoubleSide }));
	overlay(g.swamp, swampMat, LAND_Y + 0.008);
	// river, ponds and swamp channels as water lying in the land
	for (const d of [g.river, ...g.swampChannels]) {
		const pts = pathPoints(d, 20);
		const geo = new Geo();
		const w = d === g.river ? 16 : 6;
		for (let i = 0; i < pts.length - 1; i += 1) {
			const [ax, az] = toW(...pts[i]);
			const [bx, bz] = toW(...pts[i + 1]);
			const l = Math.hypot(bx - ax, bz - az) || 1;
			const nx = (-(bz - az) / l) * w * S * 0.5;
			const nz = ((bx - ax) / l) * w * S * 0.5;
			const y = LAND_Y + 0.02;
			geo.quad(
				[
					[ax - nx, y, az - nz],
					[bx - nx, y, bz - nz],
					[bx + nx, y, bz + nz],
					[ax + nx, y, az + nz]
				],
				[0, 1, 0],
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				]
			);
		}
		const m = new Mesh(keep(geo.build()), waterMat);
		root.add(m);
		waterMeshes.push(m);
	}

	// ---------- roads ----------
	const grid = new Grid();
	/** poles, lights and palm trunks: [x, z, radius] in world metres */
	const props: [number, number, number][] = [];
	const road = new Geo();
	const marks = new Geo();
	const walk = new Geo();
	const curb = new Geo();
	const barrier = new Geo();
	const hw = ROAD_W / 2;
	const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
		const dx = bx - ax;
		const dz = bz - az;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
		return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
	};
	const edgesW = LAND_EDGES.map(([a, b]) => {
		const [ax, az] = toW(...LAND_NODES[a]);
		const [bx, bz] = toW(...LAND_NODES[b]);
		return { a, b, ax, az, bx, bz };
	});
	const riverPts = pathPoints(g.river, 16);
	const blockedFast = (mx: number, my: number) =>
		!onLand(mx, my) || insideRect(g.airport, mx, my, 10) || insideRect(g.banyanPark, mx, my, 4) || mx < 250 || riverPts.some(([px, py]) => Math.hypot(px - mx, py - my) < 22);

	// mark road corridors and no-build ground in the grid
	for (let i = 0; i < grid.nx; i += 1)
		for (let j = 0; j < grid.nz; j += 1) {
			const x = grid.x0 + (i + 0.5) * grid.cell;
			const z = grid.z0 + (j + 0.5) * grid.cell;
			let near = Infinity;
			for (const e of edgesW) near = Math.min(near, segDist(x, z, e.ax, e.az, e.bx, e.bz));
			if (near < hw + WALK_W + 1.2) grid.data[j * grid.nx + i] = 1;
			else if (blockedFast(x / S + CX, z / S + CY)) grid.data[j * grid.nx + i] = 3;
		}

	const Y = (mx: number, my: number) => roadY(mx, my);
	// bridge and pier supports in the water, for the hull checks
	const pierBoxes: { x: number; z: number; fx: number; fz: number; along: number; across: number }[] = [];
	for (const e of edgesW) {
		const A = LAND_NODES[e.a];
		const B = LAND_NODES[e.b];
		const len = Math.hypot(e.bx - e.ax, e.bz - e.az);
		if (len < 0.5) continue;
		const fx = (e.bx - e.ax) / len;
		const fz = (e.bz - e.az) / len;
		const rx = -fz;
		const rz = fx;
		const bridge = BRIDGE_NODES.has(e.a) && BRIDGE_NODES.has(e.b);
		// a road that runs out over water (the marina dock, the inlet) is a pier
		const pier = !bridge && (!onLand(A[0], A[1]) || !onLand(B[0], B[1]));
		const n = Math.max(1, Math.ceil(len / (bridge ? 3 : 12)));
		const at = (t: number): [number, number, number] => {
			const mx = A[0] + (B[0] - A[0]) * t;
			const my = A[1] + (B[1] - A[1]) * t;
			return [e.ax + (e.bx - e.ax) * t, Y(mx, my), e.az + (e.bz - e.az) * t];
		};
		const strip = (geo: Geo, off0: number, off1: number, dy: number, t0: number, t1: number, color: string, uvScale = 8, steps = n) => {
			if (t1 <= t0) return;
			for (let i = 0; i < steps; i += 1) {
				const ta = t0 + ((t1 - t0) * i) / steps;
				const tb = t0 + ((t1 - t0) * (i + 1)) / steps;
				const [x0, y0, z0] = at(ta);
				const [x1, y1, z1] = at(tb);
				const ua = (ta * len) / uvScale;
				const ub = (tb * len) / uvScale;
				geo.quad(
					[
						[x0 + rx * off0, y0 + dy, z0 + rz * off0],
						[x1 + rx * off0, y1 + dy, z1 + rz * off0],
						[x1 + rx * off1, y1 + dy, z1 + rz * off1],
						[x0 + rx * off1, y0 + dy, z0 + rz * off1]
					],
					[0, 1, 0],
					[
						[ua, 0],
						[ub, 0],
						[ub, 1],
						[ua, 1]
					],
					color
				);
			}
		};
		// asphalt runs a little past each node so junctions close up
		const ext = hw / len;
		strip(road, -hw, hw, 0.03, -ext, 1 + ext, '#ffffff', ROAD_W);
		const ja = isJunction(e.a);
		const jb = isJunction(e.b);
		const big = (k: string) => edgesAt(k).length >= 3;
		const tm0 = (big(e.a) ? hw + 4.2 : ja ? hw : 0) / len;
		const tm1 = 1 - (big(e.b) ? hw + 4.2 : jb ? hw : 0) / len;
		// double yellow centre, white edge lines
		strip(marks, -0.26, -0.12, 0.05, tm0, tm1, '#e2b52a');
		strip(marks, 0.12, 0.26, 0.05, tm0, tm1, '#e2b52a');
		strip(marks, -hw + 0.3, -hw + 0.45, 0.05, tm0, tm1, '#f1f1ee');
		strip(marks, hw - 0.45, hw - 0.3, 0.05, tm0, tm1, '#f1f1ee');
		// zebra crossings at real junctions
		for (const [node, t0, dir] of [
			[e.a, 0, 1],
			[e.b, 1, -1]
		] as const) {
			if (!big(node)) continue;
			const tA = t0 + (dir * (hw + 0.8)) / len;
			const tB = t0 + (dir * (hw + 3.6)) / len;
			for (let k = -hw + 0.6; k < hw - 0.6; k += 1.2) strip(marks, k, k + 0.6, 0.05, Math.min(tA, tB), Math.max(tA, tB), '#f1f1ee', 8, 1);
		}
		if (bridge || pier) {
			// parapets and a deck you can see from the water
			strip(barrier, -hw - 0.5, -hw, 0.9, 0, 1, '#d9d6cf', 4);
			strip(barrier, hw, hw + 0.5, 0.9, 0, 1, '#d9d6cf', 4);
			for (let i = 0; i < n; i += 1) {
				const [x0, y0, z0] = at(i / n);
				const [x1, y1, z1] = at((i + 1) / n);
				for (const side of [-1, 1]) {
					const o = side * (hw + 0.5);
					const oi = side * hw;
					barrier.quad(
						[
							[x0 + rx * o, y0 - 1.2, z0 + rz * o],
							[x1 + rx * o, y1 - 1.2, z1 + rz * o],
							[x1 + rx * o, y1 + 0.9, z1 + rz * o],
							[x0 + rx * o, y0 + 0.9, z0 + rz * o]
						],
						[rx * side, 0, rz * side],
						[
							[0, 0],
							[1, 0],
							[1, 1],
							[0, 1]
						],
						'#e4e1da'
					);
					barrier.quad(
						[
							[x0 + rx * oi, y0, z0 + rz * oi],
							[x1 + rx * oi, y1, z1 + rz * oi],
							[x1 + rx * oi, y1 + 0.9, z1 + rz * oi],
							[x0 + rx * oi, y0 + 0.9, z0 + rz * oi]
						],
						[-rx * side, 0, -rz * side],
						[
							[0, 0],
							[1, 0],
							[1, 1],
							[0, 1]
						],
						'#cfccc4'
					);
				}
				barrier.quad(
					[
						[x0 - rx * (hw + 0.5), y0 - 1.2, z0 - rz * (hw + 0.5)],
						[x1 - rx * (hw + 0.5), y1 - 1.2, z1 - rz * (hw + 0.5)],
						[x1 + rx * (hw + 0.5), y1 - 1.2, z1 + rz * (hw + 0.5)],
						[x0 + rx * (hw + 0.5), y0 - 1.2, z0 + rz * (hw + 0.5)]
					],
					[0, -1, 0],
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 1]
					],
					'#a9a69f'
				);
			}
			// piers, except in the navigation channel under the middle of the arch
			for (let t = 0.12; t < 0.95; t += 0.19) {
				const [x, y, z] = at(t);
				if (y < LAND_Y + 0.5 && !pier) continue;
				const pmx = A[0] + (B[0] - A[0]) * t;
				if (bridge && pmx >= BRIDGE_CHANNEL[0] && pmx <= BRIDGE_CHANNEL[1]) continue;
				// a pier is a bent across the deck, 1.6 m thick along the road
				barrier.box(x, -1, z, ROAD_W * 0.8, y - 1.2 + 1, 1.6, Math.atan2(fx, fz), '#d2cec6', [4, 4]);
				pierBoxes.push({ x, z, fx, fz, along: 0.8, across: ROAD_W * 0.4 });
			}
			continue;
		}
		// sidewalks with a curb face
		const tw0 = (ja ? hw : -WALK_W) / len;
		const tw1 = 1 - (jb ? hw : -WALK_W) / len;
		for (const side of [-1, 1]) {
			const o0 = side * hw;
			const o1 = side * (hw + WALK_W);
			strip(walk, Math.min(o0, o1), Math.max(o0, o1), 0.16, tw0, tw1, '#ffffff', 3);
			for (let i = 0; i < n; i += 1) {
				const ta = tw0 + ((tw1 - tw0) * i) / n;
				const tb = tw0 + ((tw1 - tw0) * (i + 1)) / n;
				const [x0, y0, z0] = at(ta);
				const [x1, y1, z1] = at(tb);
				curb.quad(
					[
						[x0 + rx * o0, y0 + 0.02, z0 + rz * o0],
						[x1 + rx * o0, y1 + 0.02, z1 + rz * o0],
						[x1 + rx * o0, y1 + 0.16, z1 + rz * o0],
						[x0 + rx * o0, y0 + 0.16, z0 + rz * o0]
					],
					[-rx * side, 0, -rz * side],
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 1]
					],
					'#bdb9b1'
				);
			}
		}
	}
	const asphaltTex = keep(asphalt());
	const walkTex = keep(concrete('#d6d3cc'));
	const roadMat = keep(new MeshStandardMaterial({ map: asphaltTex, roughness: 0.88, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
	const markMat = keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
	const walkMat = keep(new MeshStandardMaterial({ map: walkTex, roughness: 0.92, side: DoubleSide }));
	const plainMat = keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide }));
	for (const [geo, mat] of [
		[road, roadMat],
		[marks, markMat],
		[walk, walkMat],
		[curb, plainMat],
		[barrier, plainMat]
	] as const) {
		if (geo.empty) continue;
		const m = new Mesh(keep(geo.build()), mat);
		m.receiveShadow = true;
		m.castShadow = geo === barrier;
		root.add(m);
	}

	// ---------- buildings ----------
	const deco = new Geo();
	const glass = new Geo();
	const trim = new Geo();
	const isDowntown = (mx: number, my: number) => insideRect(g.downtownArea, mx, my, -4);
	const addBuilding = (x: number, z: number, w: number, d: number, rot: number, frontRow: boolean): boolean => {
		const [mx, my] = [x / S + CX, z / S + CY];
		if (blockedFast(mx, my)) return false;
		const ok = grid.rect(x, z, w + 1, d + 1, rot, (px, pz) => grid.get(px, pz) === 0);
		if (!ok) return false;
		grid.rect(x, z, w + 1, d + 1, rot, (px, pz) => (grid.set(px, pz, 2), true));
		const down = isDowntown(mx, my);
		const tower = down && r() < (frontRow ? 0.45 : 0.6);
		if (tower) {
			const h = 24 + r() * (frontRow ? 40 : 60);
			grid.rect(x, z, w + 1, d + 1, rot, (px, pz) => (grid.raise(px, pz, LAND_Y + h + 3.2), true));
			const tint = new Color(['#e8f0f7', '#dfe9f2', '#f3f1ea', '#e6efe9'][Math.floor(r() * 4)]);
			glass.box(x, LAND_Y, z, w, h, d, rot, tint, [4, 3.6], { topUv: [0.01, 0.99] });
			trim.box(x, LAND_Y + h, z, w + 0.4, 0.8, d + 0.4, rot, '#eef0f2');
			if (r() < 0.5) trim.box(x, LAND_Y + h + 0.8, z, w * 0.5, 2.2, d * 0.5, rot, '#dfe3e7');
			return true;
		}
		const floors = down ? 3 + Math.floor(r() * 4) : 1 + Math.floor(r() * (frontRow ? 3 : 4)) + (r() < 0.3 ? 1 : 0);
		const h = floors * 3.6 + 0.6;
		grid.rect(x, z, w + 1, d + 1, rot, (px, pz) => (grid.raise(px, pz, LAND_Y + h * 1.0 + 3.5), true));
		const tint = new Color(PASTEL[Math.floor(r() * PASTEL.length)]);
		deco.box(x, LAND_Y, z, w, h, d, rot, tint, [4, 3.6], { topUv: [0.03, 0.97], vOffset: 0 });
		// parapet and eyebrow ledges in white, the deco look
		trim.box(x, LAND_Y + h, z, w + 0.3, 0.7, d + 0.3, rot, '#fbfbf8');
		if (!lo)
			for (let f = 1; f <= floors; f += 1) trim.box(x, LAND_Y + f * 3.6 - 1.15, z, w + 0.7, 0.14, d + 0.7, rot, '#fbfbf8', [1, 1], { bottom: true });
		if (r() < 0.35) {
			// a centred fin rising over the roofline
			const c = Math.cos(rot);
			const s = Math.sin(rot);
			const fx = x + (d / 2 + 0.2) * s;
			const fz = z + (d / 2 + 0.2) * c;
			trim.box(fx, LAND_Y + h * 0.4, fz, 1.2, h * 0.6 + 3, 0.6, rot, PASTEL[Math.floor(r() * 6)]);
		}
		return true;
	};

	// front row along every land road, both sides
	for (const e of edgesW) {
		if (BRIDGE_NODES.has(e.a) && BRIDGE_NODES.has(e.b)) continue;
		const len = Math.hypot(e.bx - e.ax, e.bz - e.az);
		const fx = (e.bx - e.ax) / len;
		const fz = (e.bz - e.az) / len;
		const rot = Math.atan2(fx, fz) + Math.PI / 2;
		for (const side of [-1, 1]) {
			let s = hw + WALK_W + 2;
			while (s < len - 6) {
				const w = 10 + r() * 14;
				const d = 9 + r() * 9;
				const off = hw + WALK_W + 1.6 + d / 2;
				const cx = e.ax + fx * (s + w / 2) + -fz * side * off;
				const cz = e.az + fz * (s + w / 2) + fx * side * off;
				// the facade (+z local) faces the road
				const ok = addBuilding(cx, cz, w, d, rot + (side < 0 ? Math.PI : 0), true);
				s += ok ? w + 1 + r() * 3 : 3;
			}
		}
	}
	// fill the blocks behind
	const fills = lo ? 220 : 520;
	for (let i = 0; i < fills * 3 && i < 4000; i += 1) {
		const x = grid.x0 + r() * grid.nx * grid.cell;
		const z = grid.z0 + r() * grid.nz * grid.cell;
		addBuilding(x, z, 9 + r() * 14, 9 + r() * 14, Math.round(r() * 4) * (Math.PI / 2), false);
	}

	// skyline far inland, hazed by the fog
	for (let i = 0; i < (lo ? 40 : 90); i += 1) {
		const a = Math.PI * (0.55 + r() * 0.95);
		const rad = 520 + r() * 650;
		const x = Math.cos(a) * rad - 60;
		const z = Math.sin(a) * rad * 0.9;
		const h = 30 + Math.pow(r(), 1.6) * 170;
		const w = 18 + r() * 30;
		if (r() < 0.6) glass.box(x, LAND_Y, z, w, h, w * (0.7 + r() * 0.6), r() * 3, '#e4ecf3', [4, 3.6], { topUv: [0.01, 0.99] });
		else deco.box(x, LAND_Y, z, w, h * 0.4, w, r() * 3, PASTEL[Math.floor(r() * PASTEL.length)], [4, 3.6]);
	}
	// ground for the far skyline
	const far = new Mesh(keep(new PlaneGeometry(1800, 2600)), keep(new MeshStandardMaterial({ color: '#9aa58a', roughness: 1 })));
	far.rotation.x = -Math.PI / 2;
	far.position.set(-1060, LAND_Y - 0.05, 0);
	root.add(far);

	const decoTex = keep(decoBay());
	const glassTex = keep(glassBay());
	const decoMat = keep(new MeshStandardMaterial({ map: decoTex, vertexColors: true, roughness: 0.85, side: DoubleSide }));
	const glassMat = keep(new MeshStandardMaterial({ map: glassTex, vertexColors: true, roughness: 0.22, metalness: 0.35, envMap: env, envMapIntensity: 0.9, side: DoubleSide }));
	const trimMat = keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide }));
	for (const [geo, mat] of [
		[deco, decoMat],
		[glass, glassMat],
		[trim, trimMat]
	] as const) {
		const m = new Mesh(keep(geo.build()), mat);
		m.castShadow = !lo;
		m.receiveShadow = true;
		root.add(m);
	}

	// ---------- palms ----------
	const palmSpots: [number, number, number][] = [];
	for (const e of edgesW) {
		if (BRIDGE_NODES.has(e.a) && BRIDGE_NODES.has(e.b)) continue;
		const len = Math.hypot(e.bx - e.ax, e.bz - e.az);
		const fx = (e.bx - e.ax) / len;
		const fz = (e.bz - e.az) / len;
		for (const side of [-1, 1]) {
			for (let s = hw + 5 + r() * 4; s < len - hw - 4; s += (lo ? 22 : 13) + r() * 6) {
				const off = hw + WALK_W + 0.7;
				const x = e.ax + fx * s - fz * side * off;
				const z = e.az + fz * s + fx * side * off;
				if (!onLand(x / S + CX, z / S + CY)) continue;
				palmSpots.push([x, z, LAND_Y]);
			}
		}
	}
	// Banyan Park, the marina edge and the island beach get groups of palms
	for (let i = 0; i < (lo ? 20 : 45); i += 1) {
		const mx = g.banyanPark.x + 6 + r() * (g.banyanPark.w - 12);
		const my = g.banyanPark.y + 6 + r() * (g.banyanPark.h - 12);
		const [x, z] = toW(mx, my);
		if (grid.get(x, z) === 0) palmSpots.push([x, z, LAND_Y]);
	}
	for (let i = 0; i < (lo ? 40 : 90); i += 1) {
		const t = r();
		const my = 60 + t * 720;
		const mx = 975 + t * 50 + 6 + r() * 14;
		if (!onLand(mx, my)) continue;
		const [x, z] = toW(mx, my);
		if (grid.get(x, z) !== 2) palmSpots.push([x, z, LAND_Y]);
	}
	const parkMat = keep(new MeshStandardMaterial({ color: '#6f9b4f', roughness: 1, side: DoubleSide }));
	overlay(rectPath(g.banyanPark.x, g.banyanPark.y, g.banyanPark.w, g.banyanPark.h), parkMat, LAND_Y + 0.012);
	const sandMat = keep(new MeshStandardMaterial({ color: '#e9dcb8', roughness: 1, side: DoubleSide }));
	overlay(g.islandNorth, sandMat, LAND_Y + 0.006);

	for (const [x, z] of palmSpots) props.push([x, z, 0.7]);
	const palms = makePalms(palmSpots, r, lo, keep);
	root.add(palms);

	// ---------- traffic signals on mast arms, street lights ----------
	const pole = new Geo();
	const lamps = new Geo();
	for (const node of Object.keys(LAND_NODES)) {
		const es = edgesAt(node);
		if (es.length < 3 || BRIDGE_NODES.has(node)) continue;
		const [nx, nz] = toW(...LAND_NODES[node]);
		for (const [a, b] of es.slice(0, 2)) {
			const o = a === node ? b : a;
			const [ox, oz] = toW(...LAND_NODES[o]);
			const l = Math.hypot(ox - nx, oz - nz) || 1;
			const fx = (ox - nx) / l;
			const fz = (oz - nz) / l;
			const rx = -fz;
			const rz = fx;
			const px = nx + fx * (hw + 1.6) + rx * (hw + WALK_W - 0.3);
			const pz = nz + fz * (hw + 1.6) + rz * (hw + WALK_W - 0.3);
			const y0 = LAND_Y + 0.16;
			pole.cyl(px, pz, y0, y0 + 7.2, 0.17, '#5d6266', 10);
			props.push([px, pz, 0.45]);
			// the arm reaches back across the road at 6.6 m
			const armLen = ROAD_W + 1.5;
			const steps = 6;
			for (let i = 0; i < steps; i += 1) {
				const t0 = (i / steps) * armLen;
				const t1 = ((i + 1) / steps) * armLen;
				const rad = 0.13 - i * 0.012;
				const ax0 = px - rx * t0;
				const az0 = pz - rz * t0;
				const ax1 = px - rx * t1;
				const az1 = pz - rz * t1;
				const yy = y0 + 6.6 + (1 - i / steps) * 0.25;
				pole.box((ax0 + ax1) / 2, yy - rad, (az0 + az1) / 2, rad * 2, rad * 2, t1 - t0, Math.atan2(rx, rz), '#5d6266');
			}
			for (const t of [0.35, 0.7]) {
				const hx = px - rx * armLen * t;
				const hz = pz - rz * armLen * t;
				const hy = y0 + 6.6 - 1.25;
				const rot = Math.atan2(fx, fz);
				pole.box(hx, hy, hz, 0.42, 1.2, 0.32, rot, '#e0b22e');
				pole.box(hx, hy + 1.2, hz, 0.06, 0.2, 0.06, rot, '#5d6266');
				// lamps face the traffic coming in along this edge
				const lx = hx + fx * 0.17;
				const lz = hz + fz * 0.17;
				for (const [k, col] of [
					[0, '#3a1110'],
					[1, '#3b3208'],
					[2, '#22e07a']
				] as const) {
					lamps.box(lx, hy + 0.95 - k * 0.36, lz, 0.22, 0.22, 0.04, rot, col);
				}
				pole.box(hx - fx * 0.2, hy - 0.05, hz - fz * 0.2, 0.62, 1.3, 0.05, rot, '#3b3f42');
			}
		}
	}
	// cobra-head street lights every so often
	for (const e of edgesW) {
		if (BRIDGE_NODES.has(e.a) && BRIDGE_NODES.has(e.b)) continue;
		const len = Math.hypot(e.bx - e.ax, e.bz - e.az);
		const fx = (e.bx - e.ax) / len;
		const fz = (e.bz - e.az) / len;
		let side = 1;
		for (let s = hw + 14; s < len - hw - 8; s += lo ? 60 : 34) {
			const off = side * (hw + WALK_W - 0.35);
			const x = e.ax + fx * s - fz * off;
			const z = e.az + fz * s + fx * off;
			const y0 = LAND_Y + 0.16;
			pole.cyl(x, z, y0, y0 + 8, 0.1, '#8d9296', 6);
			props.push([x, z, 0.35]);
			const ax = x + fz * side * 3.6;
			const az = z - fx * side * 3.6;
			pole.box((x + ax) / 2, y0 + 7.9, (z + az) / 2, 0.12, 0.12, 3.7, Math.atan2(fz * side, -fx * side), '#8d9296');
			pole.box(ax, y0 + 7.75, az, 0.35, 0.22, 0.8, Math.atan2(fz * side, -fx * side), '#a3a8ac');
			side = -side;
		}
	}
	// marina pontoons
	for (const [x, y, w] of g.marinaPiers) {
		const [cx, cz] = toW(x + w / 2, y + 1.5);
		pole.box(cx, 0.35, cz, w * S, 0.3, 1.8, 0, '#b8a888');
	}
	const poleMat = keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3, side: DoubleSide }));
	const pm = new Mesh(keep(pole.build()), poleMat);
	pm.castShadow = true;
	pm.receiveShadow = true;
	root.add(pm);
	const lampMat = keep(new MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
	root.add(new Mesh(keep(lamps.build()), lampMat));

	void BRIDGE_RISE;
	void onBridge;
	// bucket the props in 8 m cells so a lookup checks a handful, not hundreds
	const PB = 8;
	const buckets = new Map<string, [number, number, number][]>();
	for (const p of props) {
		const key = `${Math.floor(p[0] / PB)},${Math.floor(p[1] / PB)}`;
		const list = buckets.get(key);
		if (list) list.push(p);
		else buckets.set(key, [p]);
	}
	const collide: Collide = {
		solid(x, z, rad = 0) {
			if (grid.get(x, z) === 2) return true;
			if (rad > 0) {
				for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) if (grid.get(x + dx, z + dz) === 2) return true;
			}
			const bx = Math.floor(x / PB);
			const bz = Math.floor(z / PB);
			for (let i = -1; i <= 1; i += 1)
				for (let j = -1; j <= 1; j += 1)
					for (const [px, pz, pr] of buckets.get(`${bx + i},${bz + j}`) ?? []) if (Math.hypot(px - x, pz - z) < pr + rad) return true;
			return false;
		},
		deck(x, z) {
			// a pier under the bridge or a dock, with a hull's worth of margin
			for (const b of pierBoxes) {
				const dx = x - b.x;
				const dz = z - b.z;
				const al = Math.abs(dx * b.fx + dz * b.fz);
				const ac = Math.abs(-dx * b.fz + dz * b.fx);
				if (al < b.along + 0.3 && ac < b.across + 0.3) return true;
			}
			if (grid.get(x, z) !== 1) return false;
			const mx = x / S + CX;
			const mz = z / S + CY;
			if (onLand(mx, mz)) return false;
			// the deck itself (road and curb), at the height of its centre line
			for (const e of edgesW) {
				if (segDist(x, z, e.ax, e.az, e.bx, e.bz) >= hw + 1) continue;
				const dx = e.bx - e.ax;
				const dz = e.bz - e.az;
				const t = Math.max(0, Math.min(1, ((x - e.ax) * dx + (z - e.az) * dz) / (dx * dx + dz * dz || 1)));
				const [cx, cz] = [(e.ax + dx * t) / S + CX, (e.az + dz * t) / S + CY];
				if (roadY(cx, cz) < LAND_Y + 3) return true;
			}
			return false;
		},
		roof(x, z, rad) {
			let top = 0;
			for (let a = -rad; a <= rad; a += grid.cell) for (let b = -rad; b <= rad; b += grid.cell) if (a * a + b * b <= rad * rad) top = Math.max(top, grid.top(x + a, z + b));
			return top;
		}
	};
	return {
		group: root,
		waterMeshes,
		collide,
		dispose() {
			for (const o of owned) o.dispose();
		}
	};
}

/** Tall Florida palms: a leaning ringed trunk and a crown of drooping fronds, instanced. */
function makePalms(spots: [number, number, number][], r: () => number, lo: boolean, keep: <T extends { dispose(): void }>(x: T) => T): Object3D {
	const group = new Group();
	const H = 10;
	const lean = 0.9;
	const trunk = new Geo();
	const seg = 10;
	const radial = 7;
	const centre = (t: number): [number, number, number] => [lean * t * t, t * H, 0];
	for (let i = 0; i < seg; i += 1) {
		const t0 = i / seg;
		const t1 = (i + 1) / seg;
		const [x0, y0] = centre(t0);
		const [x1, y1] = centre(t1);
		const r0 = 0.24 - t0 * 0.09;
		const r1 = 0.24 - t1 * 0.09;
		for (let k = 0; k < radial; k += 1) {
			const a0 = (k / radial) * Math.PI * 2;
			const a1 = ((k + 1) / radial) * Math.PI * 2;
			const am = (a0 + a1) / 2;
			trunk.quad(
				[
					[x0 + Math.cos(a0) * r0, y0, Math.sin(a0) * r0],
					[x0 + Math.cos(a1) * r0, y0, Math.sin(a1) * r0],
					[x1 + Math.cos(a1) * r1, y1, Math.sin(a1) * r1],
					[x1 + Math.cos(a0) * r1, y1, Math.sin(a0) * r1]
				],
				[Math.cos(am), 0, Math.sin(am)],
				[
					[k / radial, t0 * 6],
					[(k + 1) / radial, t0 * 6],
					[(k + 1) / radial, t1 * 6],
					[k / radial, t1 * 6]
				]
			);
		}
	}
	const crown = new Geo();
	const [tx, ty] = centre(1);
	const fronds = 13;
	const fr = rng(77);
	for (let f = 0; f < fronds; f += 1) {
		const yaw = (f / fronds) * Math.PI * 2 + fr() * 0.3;
		const up = f % 3 === 0 ? 0.55 : 0.25 + fr() * 0.2;
		const L = 3.6 + fr() * 1.2;
		const W = 1.5;
		const steps = 8;
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);
		const pts: [number, number, number][] = [];
		for (let i = 0; i <= steps; i += 1) {
			const t = i / steps;
			const d = t * L;
			const y = up * d * 1.1 - t * t * L * 0.85;
			pts.push([tx + cy * d, ty + y, sy * d]);
		}
		for (let i = 0; i < steps; i += 1) {
			const t0 = i / steps;
			const t1 = (i + 1) / steps;
			const [ax, ay, az] = pts[i];
			const [bx, by, bz] = pts[i + 1];
			// side vector is horizontal and across the frond, with a slight V fold
			const sx = -sy * (W / 2);
			const sz = cy * (W / 2);
			const fold = 0.18;
			crown.quad(
				[
					[ax - sx, ay - fold, az - sz],
					[bx - sx, by - fold, bz - sz],
					[bx, by, bz],
					[ax, ay, az]
				],
				[0, 1, 0],
				[
					[t0, 0],
					[t1, 0],
					[t1, 0.5],
					[t0, 0.5]
				]
			);
			crown.quad(
				[
					[ax, ay, az],
					[bx, by, bz],
					[bx + sx, by - fold, bz + sz],
					[ax + sx, ay - fold, az + sz]
				],
				[0, 1, 0],
				[
					[t0, 0.5],
					[t1, 0.5],
					[t1, 1],
					[t0, 1]
				]
			);
		}
	}
	const trunkMat = keep(new MeshStandardMaterial({ map: keep(bark()), roughness: 0.95 }));
	const frondTex = keep(frond());
	const crownMat = keep(new MeshStandardMaterial({ map: frondTex, alphaTest: 0.45, side: DoubleSide, roughness: 0.8 }));
	const n = spots.length;
	const tm = new InstancedMesh(keep(trunk.build()), trunkMat, n);
	const cm = new InstancedMesh(keep(crown.build()), crownMat, n);
	const m = new Matrix4();
	const o = new Object3D();
	spots.forEach(([x, z, y], i) => {
		o.position.set(x, y, z);
		o.rotation.set(0, r() * Math.PI * 2, 0);
		const s = 0.75 + r() * 0.5;
		o.scale.set(s, s * (0.85 + r() * 0.35), s);
		o.updateMatrix();
		m.copy(o.matrix);
		tm.setMatrixAt(i, m);
		cm.setMatrixAt(i, m);
	});
	tm.castShadow = cm.castShadow = !lo;
	tm.receiveShadow = true;
	group.add(tm, cm);
	return group;
}
