/**
 * The things that move in the street view. Cars and people are Quaternius CC0 models (see
 * ASSETS.md), the jet ski is built here, the box truck and Marine Two are Kenney CC0. Each unit
 * reads the shared sim position every frame, smooths its heading, keeps to the right lane or the
 * sidewalk, follows the bridge arch, and reports a pose the chase camera can follow.
 */
import {
	AnimationMixer,
	Box3,
	BufferAttribute,
	BufferGeometry,
	AdditiveBlending,
	CircleGeometry,
	Color,
	ConeGeometry,
	DoubleSide,
	Euler,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	Quaternion,
	Vector3,
	type AnimationAction,
	type AnimationClip,
	type Material
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { UnitInfo, UnitSim } from '#lib/scanner/world.svelte.js';
import { Geo } from './geo';
import { LAND_Y, ROAD_W, WALK_W, onBridge, onLand, roadY, toMap, toW } from './space';
import type { Collide } from './city';
import { foam, shirtPrint } from './textures';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<{ scene: Object3D; clips: AnimationClip[] }>>();
function load(url: string) {
	let p = cache.get(url);
	if (!p) {
		p = loader.loadAsync(url).then((g) => ({ scene: g.scene, clips: g.animations }));
		cache.set(url, p);
	}
	return p;
}

/** The sim names a model per unit (channels.py); the street view swaps in its own files. */
const MODELS: Record<string, { url: string; len: number; axis: 'z' | 'y' }> = {
	police: { url: '/models/v4/car_cop.glb', len: 4.7, axis: 'z' },
	sedan: { url: '/models/v4/car_normal_car1.glb', len: 4.7, axis: 'z' },
	suv: { url: '/models/v4/car_suv.glb', len: 4.9, axis: 'z' },
	taxi: { url: '/models/v4/car_taxi.glb', len: 4.7, axis: 'z' },
	hatchback_sports: { url: '/models/v4/car_sports_car.glb', len: 4.5, axis: 'z' },
	truck: { url: '/models/truck.glb', len: 7.2, axis: 'z' },
	boat_speed_a: { url: '/models/boat_speed_a.glb', len: 9, axis: 'z' },
	character_a: { url: '/models/v4/hero_casual.glb', len: 1.8, axis: 'y' },
	character_d: { url: '/models/v4/hero_beach.glb', len: 1.8, axis: 'y' }
};

export interface Pose {
	pos: Vector3;
	yaw: number;
	speed: number;
	kind: UnitInfo['kind'];
}

export interface StreetUnit {
	group: Group;
	/** world-space things (the wake) that the scene adds next to the unit */
	extras: Object3D[];
	pose: Pose;
	update(u: UnitSim, t: number, dt: number, col?: Collide | null): void;
	dispose(): void;
}

function fit(model: Object3D, target: number, axis: 'z' | 'y') {
	model.updateMatrixWorld(true);
	const box = new Box3().setFromObject(model);
	const size = box.getSize(new Vector3());
	const s = target / ((axis === 'z' ? Math.max(size.z, size.x) : size.y) || 1);
	model.scale.multiplyScalar(s);
	model.updateMatrixWorld(true);
	const b2 = new Box3().setFromObject(model);
	const c = b2.getCenter(new Vector3());
	model.position.x -= c.x;
	model.position.z -= c.z;
	model.position.y -= b2.min.y;
}

function shadows(o: Object3D) {
	o.traverse((m) => {
		if ((m as Mesh).isMesh) {
			m.castShadow = true;
			m.receiveShadow = true;
			(m as Mesh).frustumCulled = false;
		}
	});
}

const angleTo = (a: number, b: number) => {
	let d = (b - a) % (Math.PI * 2);
	if (d > Math.PI) d -= Math.PI * 2;
	if (d < -Math.PI) d += Math.PI * 2;
	return d;
};

/** A person with idle, walk and run clips. */
async function person(modelKey: string) {
	const m = MODELS[modelKey];
	const src = await load(m.url);
	const model = cloneSkinned(src.scene);
	if (modelKey === 'character_d') {
		const print = shirtPrint();
		model.traverse((o) => {
			const mesh = o as Mesh;
			if (!mesh.isMesh) return;
			const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
			mesh.material = mats.map((mt) => {
				if (mt.name === 'LightBrown') {
					const c = mt.clone();
					c.map = print;
					c.color = new Color('#ffffff');
					return c;
				}
				return mt;
			}) as unknown as Material;
			if (Array.isArray(mesh.material) && mesh.material.length === 1) mesh.material = mesh.material[0];
		});
	}
	fit(model, m.len, 'y');
	shadows(model);
	const mixer = new AnimationMixer(model);
	const actions: Record<string, AnimationAction> = {};
	for (const name of ['Idle', 'Walk', 'Run']) {
		const clip = src.clips.find((c) => c.name === name);
		if (clip) actions[name] = mixer.clipAction(clip);
	}
	let current = '';
	const play = (name: string, scale = 1) => {
		const next = actions[name];
		if (!next) return;
		next.timeScale = scale;
		if (current === name) return;
		next.reset().fadeIn(0.25).play();
		actions[current]?.fadeOut(0.25);
		current = name;
	};
	play('Idle');
	return { model, mixer, play };
}

/** A sit-down jet ski, about 3.2 m: teal and white hull, black seat, bars and a small screen. */
function jetSkiHull(): Object3D {
	const geo = new Geo();
	const sections = 9;
	const L = 3.2;
	const ring = (t: number) => {
		// t = 0 stern .. 1 bow
		const z = -L / 2 + t * L;
		const w = 0.58 * Math.sin(Math.min(1, (1 - t) * 1.6 + 0.15) * Math.PI * 0.5) * (t > 0.75 ? 1 - (t - 0.75) * 2.6 : 1) + 0.04;
		const keel = 0.05 + Math.max(0, t - 0.7) * 0.9;
		const deck = 0.62 + Math.max(0, t - 0.75) * 0.25;
		return [
			[0, keel, z],
			[w * 0.55, keel + 0.12, z],
			[w, 0.34, z],
			[w * 0.98, deck - 0.12, z],
			[w * 0.7, deck, z],
			[0, deck + 0.04, z]
		] as [number, number, number][];
	};
	const rings = Array.from({ length: sections + 1 }, (_, i) => ring(i / sections));
	for (let i = 0; i < sections; i += 1) {
		const a = rings[i];
		const b = rings[i + 1];
		for (let k = 0; k < a.length - 1; k += 1) {
			const col = k < 2 ? '#f4f6f7' : k === 2 ? '#1f9a9a' : k === 3 ? '#1f9a9a' : '#e9eef0';
			for (const side of [1, -1]) {
				const P = (p: [number, number, number]): [number, number, number] => [p[0] * side, p[1], p[2]];
				const nx = (a[k + 1][1] - a[k][1]) * side;
				const ny = -(a[k + 1][0] - a[k][0]);
				const ln = Math.hypot(nx, ny) || 1;
				geo.quad([P(a[k]), P(b[k]), P(b[k + 1]), P(a[k + 1])], [nx / ln, ny / ln, 0], [
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				], col);
			}
		}
	}
	// transom
	const st = rings[0];
	for (let k = 0; k < st.length - 1; k += 1)
		for (const side of [1, -1])
			geo.quad(
				[
					[0, st[k][1], st[k][2]],
					[st[k][0] * side, st[k][1], st[k][2]],
					[st[k + 1][0] * side, st[k + 1][1], st[k + 1][2]],
					[0, st[k + 1][1], st[k + 1][2]]
				],
				[0, 0, -1],
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				],
				'#d9e0e3'
			);
	geo.box(0, 0.62, -0.35, 0.46, 0.2, 1.35, 0, '#1c1f22');
	geo.box(0, 0.72, 0.55, 0.12, 0.42, 0.12, 0, '#2a2e31');
	geo.box(0, 1.08, 0.6, 0.95, 0.06, 0.08, 0, '#1c1f22');
	geo.box(0, 0.74, 0.95, 0.5, 0.22, 0.06, -0.0, '#33454f');
	geo.box(0, 0.08, -1.62, 0.18, 0.18, 0.12, 0, '#2a2e31');
	const mesh = new Mesh(geo.build(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05, side: DoubleSide }));
	mesh.castShadow = true;
	return mesh;
}

/** A widening V of foam laid on the water behind a boat: bright edges, softer middle, fading out. */
class Wake {
	n = 40;
	cols = 5;
	pts: { x: number; z: number; yaw: number; age: number }[] = [];
	geo = new BufferGeometry();
	mesh: Mesh;
	acc = 0;
	width: number;
	life = 3.2;
	constructor(width: number) {
		this.width = width;
		const nv = this.n * this.cols;
		this.geo.setAttribute('position', new BufferAttribute(new Float32Array(nv * 3), 3));
		this.geo.setAttribute('uv', new BufferAttribute(new Float32Array(nv * 2), 2));
		this.geo.setAttribute('color', new BufferAttribute(new Float32Array(nv * 4).fill(1), 4));
		const idx: number[] = [];
		for (let i = 0; i < this.n - 1; i += 1)
			for (let c = 0; c < this.cols - 1; c += 1) {
				const a = i * this.cols + c;
				const b = a + this.cols;
				idx.push(a, a + 1, b, a + 1, b + 1, b);
			}
		this.geo.setIndex(idx);
		const mat = new MeshBasicMaterial({ map: foam(), transparent: true, depthWrite: false, side: DoubleSide, vertexColors: true, toneMapped: false });
		this.mesh = new Mesh(this.geo, mat);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 2;
	}
	update(x: number, z: number, yaw: number, moving: boolean, dt: number) {
		for (const p of this.pts) p.age += dt;
		this.acc += dt;
		if (moving && this.acc > 0.04) {
			this.acc = 0;
			this.pts.unshift({ x, z, yaw, age: 0 });
		}
		while (this.pts.length > this.n || (this.pts.length && this.pts[this.pts.length - 1].age > this.life)) this.pts.pop();
		const pos = this.geo.attributes.position.array as Float32Array;
		const uv = this.geo.attributes.uv.array as Float32Array;
		const col = this.geo.attributes.color.array as Float32Array;
		// across the trail: edge, foam line, middle, foam line, edge
		const across = [-1, -0.7, 0, 0.7, 1];
		const shape = [0, 1, 0.55, 1, 0];
		for (let i = 0; i < this.n; i += 1) {
			const p = this.pts[Math.min(i, this.pts.length - 1)] ?? { x, z, yaw, age: 9 };
			const k = Math.min(1, p.age / this.life);
			const w = this.width * (0.45 + Math.sqrt(k) * 2.6);
			const rx = -Math.sin(p.yaw);
			const rz = Math.cos(p.yaw);
			const fade = i >= this.pts.length || i === 0 ? 0 : Math.pow(1 - k, 1.4);
			for (let c = 0; c < this.cols; c += 1) {
				const v = i * this.cols + c;
				pos[v * 3] = p.x + rx * w * across[c];
				pos[v * 3 + 1] = 0.07;
				pos[v * 3 + 2] = p.z + rz * w * across[c];
				uv[v * 2] = i * 0.3;
				uv[v * 2 + 1] = (across[c] + 1) / 2;
				col[v * 4 + 3] = fade * shape[c] * 0.95;
			}
		}
		this.geo.attributes.position.needsUpdate = true;
		this.geo.attributes.uv.needsUpdate = true;
		this.geo.attributes.color.needsUpdate = true;
	}
}

/** Seat placement and the bone offsets that turn the standing idle into a seated rider. */
const SEAT = { y: 0.06, z: -0.5, lean: 0.18 };
// three.js strips the dots from glTF node names, so "UpperLeg.L" is "UpperLegL"
const SEAT_POSE: [string, [number, number, number]][] = [
	['UpperLegL', [1.5, 0, 0.15]],
	['UpperLegR', [1.5, 0, -0.15]],
	['LowerLegL', [1.25, 0, 0]],
	['LowerLegR', [1.25, 0, 0]],
	['UpperArmL', [0, 0, -1.15]],
	['UpperArmR', [0, 0, 1.15]]
];

function heli(): Object3D & { rotor?: Object3D } {
	const geo = new Geo();
	geo.box(0, 0.8, 0, 2.2, 2.0, 4.6, 0, '#2a5fd0');
	geo.box(0, 1.5, 0, 2.25, 0.4, 4.65, 0, '#ffffff');
	geo.box(0, 1.2, 2.3, 1.9, 1.3, 0.9, 0, '#9cc4dc');
	geo.box(0, 1.5, -4.2, 0.5, 0.5, 4.2, 0, '#2a5fd0');
	geo.box(0, 1.8, -6.1, 0.2, 1.6, 0.8, 0, '#ffffff');
	geo.box(-1.0, 0, 0, 0.15, 0.15, 3.8, 0, '#2b2f33');
	geo.box(1.0, 0, 0, 0.15, 0.15, 3.8, 0, '#2b2f33');
	geo.box(0, 2.8, 0, 0.2, 0.5, 0.2, 0, '#2b2f33');
	const g = new Group() as Group & { rotor?: Object3D };
	const body = new Mesh(geo.build(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }));
	body.castShadow = true;
	g.add(body);
	const rg = new Geo();
	rg.box(0, 0, 0, 11, 0.06, 0.4, 0, '#2b2f33');
	rg.box(0, 0, 0, 0.4, 0.06, 11, 0, '#2b2f33');
	const rotor = new Mesh(rg.build(), new MeshStandardMaterial({ vertexColors: true }));
	rotor.position.y = 3.3;
	rotor.castShadow = true;
	g.add(rotor);
	g.rotor = rotor;
	return g;
}

export async function makeStreetUnit(info: UnitInfo): Promise<StreetUnit> {
	const group = new Group();
	const pose: Pose = { pos: new Vector3(), yaw: 0, speed: 0, kind: info.kind };
	let yaw = NaN;
	let lastX = NaN;
	let lastZ = NaN;
	let side = 0;
	// water craft: a smoothed push back onto open water when the route clips a shore
	let wox = 0;
	let woz = 0;
	let heliY = 32;
	const disposers: (() => void)[] = [];

	let animate: ((moving: boolean, running: boolean, speed: number, dt: number) => void) | null = null;
	let wake: Wake | null = null;
	let rotor: Object3D | undefined;
	let cone: Mesh | null = null;
	let pool: Mesh | null = null;
	const body = new Group();
	group.add(body);

	if (info.kind === 'person') {
		const p = await person(info.model in MODELS ? info.model : 'character_a');
		body.add(p.model);
		animate = (moving, running, speed, dt) => {
			if (!moving) p.play('Idle');
			else p.play('Run', Math.min(1.7, Math.max(0.8, speed / 6.5)));
			p.mixer.update(dt);
		};
	} else if (info.kind === 'jetski') {
		body.add(jetSkiHull());
		const rider = await person('character_d');
		// seated: hips on the seat (top at 0.82 m), thighs forward, shins down, hands on the bars
		rider.model.position.set(0, SEAT.y, SEAT.z);
		rider.model.scale.multiplyScalar(0.98);
		rider.model.rotation.x = SEAT.lean;
		body.add(rider.model);
		rider.play('Idle');
		const q = new Quaternion();
		const eu = new Euler();
		if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('lab3d'))
			Object.assign(window as unknown as Record<string, unknown>, { __seat: { SEAT, SEAT_POSE } });
		animate = (_m, _r, _s, dt) => {
			rider.mixer.update(dt * 0.4);
			rider.model.position.set(0, SEAT.y, SEAT.z);
			rider.model.rotation.x = SEAT.lean;
			for (const [name, e] of SEAT_POSE) rider.model.getObjectByName(name)?.quaternion.multiply(q.setFromEuler(eu.set(...e)));
		};
		wake = new Wake(1.3);
	} else if (info.kind === 'heli') {
		const h = heli();
		rotor = h.rotor;
		body.add(h);
		// the searchlight (spotlight tool): a faint cone and a bright pool on the ground, no real light,
		// so turning it on costs no shader recompile and no extra pass on a phone
		const coneGeo = new ConeGeometry(4.2, 1, 20, 1, true);
		coneGeo.translate(0, -0.5, 0);
		const coneMat = new MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
		cone = new Mesh(coneGeo, coneMat);
		cone.visible = false;
		cone.renderOrder = 2;
		const poolGeo = new CircleGeometry(4.6, 28);
		poolGeo.rotateX(-Math.PI / 2);
		const poolMat = new MeshBasicMaterial({ color: '#fff3cf', transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false });
		pool = new Mesh(poolGeo, poolMat);
		pool.visible = false;
		pool.renderOrder = 2;
		disposers.push(() => (coneGeo.dispose(), coneMat.dispose(), poolGeo.dispose(), poolMat.dispose()));
	} else {
		const m = MODELS[info.model];
		if (!m) throw new Error('no model');
		const src = await load(m.url);
		const model = src.scene.clone(true);
		fit(model, m.len, 'z');
		shadows(model);
		body.add(model);
		if (info.kind === 'boat') {
			wake = new Wake(1.6);
		}
	}

	return {
		group,
		extras: [...(wake ? [wake.mesh] : []), ...(pool && cone ? [pool, cone] : [])],
		pose,
		update(u, t, dt, col) {
			const [x, z] = toW(u.x, u.y);
			const step = Number.isNaN(lastX) ? 0 : Math.hypot(x - lastX, z - lastZ);
			lastX = x;
			lastZ = z;
			const inst = dt > 0 ? step / dt : 0;
			pose.speed += (inst - pose.speed) * Math.min(1, dt * 4);
			if (Number.isNaN(yaw)) yaw = u.heading;
			const turnRate = info.kind === 'person' ? 7 : info.kind === 'heli' ? 1.5 : 3.2;
			yaw += angleTo(yaw, u.heading) * Math.min(1, dt * turnRate);
			const fx = Math.cos(yaw);
			const fz = Math.sin(yaw);
			const rx = -fz;
			const rz = fx;
			// keep right: cars in the right lane, walkers on the sidewalk
			const bridge = onBridge(u.x, u.y);
			let want = 0;
			if (info.kind === 'car') want = ROAD_W / 4 - 0.1;
			if (info.kind === 'person') want = bridge ? ROAD_W / 2 - 0.8 : ROAD_W / 2 + 1.0;
			side += (want - side) * Math.min(1, dt * 2.5);
			let px = x + rx * side;
			let pz = z + rz * side;
			if (col && (info.kind === 'car' || info.kind === 'person')) {
				// slide toward the centre line until clear of buildings, poles and palms
				const rad = info.kind === 'car' ? 1.1 : 0.35;
				for (let k = 0; k < 6 && col.solid(px, pz, rad); k += 1) {
					side *= 0.6;
					px = x + rx * side;
					pz = z + rz * side;
				}
			}
			if (info.kind === 'jetski' || info.kind === 'boat') {
				// bow, middle and stern must all be on water; if not, find the nearest clear spot
				const half = info.kind === 'boat' ? 4.4 : 1.6;
				const beam = info.kind === 'boat' ? 1.5 : 0.6;
				// bow, middle and stern, each on the centre line and at both sides of the hull
				const wet = (ax: number, az: number) =>
					[-half, 0, half].every((k) =>
						[-beam, 0, beam].every((b) => {
							const bx = ax + fx * k + rx * b;
							const bz = az + fz * k + rz * b;
							const [mx, my] = toMap(bx, bz);
							return !onLand(mx, my) && !col?.deck(bx, bz);
						})
					);
				let tx = 0;
				let tz = 0;
				if (!wet(px, pz)) {
					search: for (const r of [1.5, 3, 5, 8, 12, 18]) {
						for (let a = 0; a < 16; a += 1) {
							const ang = (a / 16) * Math.PI * 2;
							const cx = Math.cos(ang) * r;
							const cz = Math.sin(ang) * r;
							if (wet(px + cx, pz + cz)) {
								tx = cx;
								tz = cz;
								break search;
							}
						}
					}
				}
				const k = Math.min(1, dt * 5);
				wox += (tx - wox) * k;
				woz += (tz - woz) * k;
				px += wox;
				pz += woz;
			}
			let y = 0;
			let pitch = 0;
			if (info.kind === 'car' || info.kind === 'person') {
				y = roadY(u.x, u.y) + 0.03 + (info.kind === 'person' && !bridge ? 0.16 : 0);
				if (bridge) {
					const ahead = roadY(u.x + Math.cos(yaw) * 4, u.y + Math.sin(yaw) * 4);
					const behind = roadY(u.x - Math.cos(yaw) * 4, u.y - Math.sin(yaw) * 4);
					pitch = Math.atan2(ahead - behind, 8 * 0.3);
				}
			} else if (info.kind === 'heli') {
				// fly over the roofs, looking ahead so it climbs before a tower, not through it
				const clear = col ? Math.max(col.roof(px, pz, 16), col.roof(px + fx * 24, pz + fz * 24, 16)) + 12 : 0;
				const target = Math.max(32, clear);
				heliY += (target - heliY) * Math.min(1, dt * (target > heliY ? 2.5 : 0.6));
				y = heliY + Math.sin(t * 1.1) * 0.6;
			} else {
				y = Math.sin(t * 2.2 + x * 0.3) * 0.06 + (u.moving ? 0.05 : 0);
			}
			if (y < LAND_Y && (info.kind === 'car' || info.kind === 'person')) y = LAND_Y;
			group.position.set(px, y, pz);
			body.rotation.set(0, 0, 0);
			body.rotation.y = Math.PI / 2 - yaw;
			const turn = angleTo(yaw, u.heading);
			if (info.kind === 'jetski' || info.kind === 'boat') {
				body.rotation.x = -(u.moving ? 0.07 : 0) + Math.sin(t * 2.6) * 0.015;
				body.rotation.z = Math.max(-0.35, Math.min(0.35, -turn * 0.9)) + Math.sin(t * 1.9) * 0.02;
			} else if (info.kind === 'car') {
				body.rotation.x = -pitch;
				body.rotation.z = Math.max(-0.05, Math.min(0.05, -turn * 0.12));
			} else if (info.kind === 'heli') {
				body.rotation.x = u.moving ? 0.12 : 0;
				body.rotation.z = Math.max(-0.25, Math.min(0.25, -turn * 0.6));
				if (rotor) rotor.rotation.y = t * 24;
				if (cone && pool) {
					const on = !!u.light;
					cone.visible = pool.visible = on;
					if (on) {
						// aim a little ahead of the nose, onto whatever is below
						const gx = px + fx * 6;
						const gz = pz + fz * 6;
						const [mx, my] = toMap(gx, gz);
						const gy = (onLand(mx, my) ? (col ? Math.max(LAND_Y, col.roof(gx, gz, 1)) : LAND_Y) : 0) + 0.06;
						const len = Math.max(4, y - gy);
						cone.position.set(px, y - 0.6, pz);
						cone.scale.set(1, len, 1);
						cone.lookAt(gx, gy, gz);
						cone.rotateX(-Math.PI / 2);
						pool.position.set(gx, gy, gz);
					}
				}
			}
			animate?.(u.moving, u.running, pose.speed, dt);
			if (wake) {
				const back = info.kind === 'boat' ? 4 : 1.5;
				wake.update(px - fx * back, pz - fz * back, yaw, u.moving, dt);
			}
			pose.pos.set(px, y, pz);
			pose.yaw = yaw;
		},
		dispose() {
			for (const d of disposers) d();
		}
	};
}

