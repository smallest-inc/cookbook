<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import {
		Color,
		DirectionalLight,
		EquirectangularReflectionMapping,
		Fog,
		Group,
		HemisphereLight,
		Object3D,
		PerspectiveCamera,
		PMREMGenerator,
		SRGBColorSpace,
		TextureLoader,
		Vector3,
		type ShaderMaterial,
		type Texture
	} from 'three';
	import { planRoute, type World } from '#lib/scanner/world.svelte.js';
	import { buildCity, type City, type Quality } from './street/city';
	import { makeStreetUnit, type StreetUnit } from './street/units';
	import { waterMaterial } from './street/water';
	import { LAND_Y, bridgeCentreY, onLand, roadY, toMap, toW, underBridge } from './street/space';

	let { world, expanded = false, quality = 'high' }: { world: World; expanded?: boolean; quality?: Quality } = $props();

	const { scene, renderer, invalidate } = useThrelte();
	const HAZE = new Color('#d3d8e0');
	const Q = untrack(() => quality);
	const LAB = typeof location !== 'undefined' && new URLSearchParams(location.search).has('lab3d');
	const FOG_NEAR = Q === 'low' ? 90 : 140;
	const FOG_FAR = Q === 'low' ? 900 : 1500;
	// where the sun sits in the sky photo, so shadows agree with it
	const SUN = new Vector3(0.553, 0.743, 0.376).normalize();

	const root = new Group();
	const unitsRoot = new Group();
	root.add(unitsRoot);
	const units = new Map<string, StreetUnit>();
	let city: City | null = null;
	let water: ShaderMaterial | null = null;
	let sky: Texture | null = null;
	let envTex: Texture | null = null;
	let camera: PerspectiveCamera | undefined = $state();

	const sun = new DirectionalLight('#fff4e0', 3.1);
	sun.castShadow = Q === 'high';
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.left = -45;
	sun.shadow.camera.right = 45;
	sun.shadow.camera.top = 45;
	sun.shadow.camera.bottom = -45;
	sun.shadow.camera.near = 1;
	sun.shadow.camera.far = 400;
	sun.shadow.bias = -0.0004;
	sun.shadow.normalBias = 0.04;
	sun.shadow.radius = 3;
	const sunTarget = new Object3D();
	sun.target = sunTarget;
	const hemi = new HemisphereLight('#cfe3ff', '#9a8f7a', 0.8);

	onMount(() => {
		let dead = false;
		if (new URLSearchParams(location.search).has('lab3d')) Object.assign(window as unknown as Record<string, unknown>, { __units: units, __renderer: renderer, __city: () => city, __planRoute: planRoute, __toW: toW, __onLand: onLand });
		scene.fog = new Fog(HAZE, FOG_NEAR, FOG_FAR);
		scene.background = HAZE.clone();
		renderer.shadowMap.enabled = Q === 'high';
		const tl = new TextureLoader();
		tl.load(Q === 'low' ? '/models/v4/sky_1k.jpg' : '/models/v4/sky_2k.jpg', (tex) => {
			if (dead) return tex.dispose();
			tex.mapping = EquirectangularReflectionMapping;
			tex.colorSpace = SRGBColorSpace;
			sky = tex;
			scene.background = tex;
			const pm = new PMREMGenerator(renderer);
			envTex = pm.fromEquirectangular(tex).texture;
			pm.dispose();
			scene.environment = envTex;
			scene.environmentIntensity = 0.45;
			water = waterMaterial(tex, SUN, HAZE, FOG_NEAR, FOG_FAR);
			city = buildCity(Q, water, envTex);
			root.add(city.group);
			invalidate();
		});
		(async () => {
			for (const [id, info] of Object.entries(world.info)) {
				try {
					const obj = await makeStreetUnit(info);
					if (dead) return;
					units.set(id, obj);
					unitsRoot.add(obj.group);
					for (const x of obj.extras) root.add(x);
				} catch {
					/* a model that fails to load leaves that unit out of the street view */
				}
			}
			invalidate();
		})();
		return () => {
			dead = true;
		};
	});

	onDestroy(() => {
		city?.dispose();
		water?.dispose();
		sky?.dispose();
		envTex?.dispose();
		for (const u of units.values()) u.dispose();
		units.clear();
		scene.fog = null;
		scene.background = null;
		scene.environment = null;
	});

	// chase rigs per kind: distance back, height, look height, sideways (over the shoulder), fov
	const RIG = {
		person: { dist: 3.5, high: 1.0, look: 1.5, side: 0.5, fov: 55, ahead: 3 },
		car: { dist: 7.6, high: 2.3, look: 1.2, side: 0, fov: 58, ahead: 6 },
		jetski: { dist: 8, high: 2.7, look: 0.5, side: 0, fov: 60, ahead: 9 },
		boat: { dist: 15, high: 4.8, look: 2.2, side: 0, fov: 56, ahead: 8 },
		heli: { dist: 26, high: 7, look: 0, side: 0, fov: 55, ahead: 10 }
	} as const;

	const camPos = new Vector3();
	const camLook = new Vector3();
	const want = new Vector3();
	const look = new Vector3();
	let camYaw = 0;
	let idleFor = 0;
	let t = 0;
	let lastFocus = '';
	let started = false;
	let blend = 1;

	// units never stand inside each other: a soft push apart, per medium (land or water)
	const RADIUS: Record<string, number> = { car: 2.5, person: 0.45, jetski: 1.6, boat: 4.4 };
	const offsets = new Map<string, Vector3>();
	const push = new Map<string, Vector3>();
	function separate(dt: number) {
		const list = [...units].filter(([, o]) => o.pose.kind in RADIUS);
		for (const [id] of list) (push.get(id) ?? push.set(id, new Vector3()).get(id)!).set(0, 0, 0);
		for (let i = 0; i < list.length; i += 1)
			for (let j = i + 1; j < list.length; j += 1) {
				const [ia, a] = list[i];
				const [ib, b] = list[j];
				const wa = a.pose.kind === 'jetski' || a.pose.kind === 'boat';
				const wb = b.pose.kind === 'jetski' || b.pose.kind === 'boat';
				if (wa !== wb) continue;
				const dx = b.pose.pos.x - a.pose.pos.x;
				const dz = b.pose.pos.z - a.pose.pos.z;
				const d = Math.hypot(dx, dz);
				const min = RADIUS[a.pose.kind] + RADIUS[b.pose.kind];
				if (d >= min) continue;
				// exactly on top of each other: split along the unit's heading
				const nx = d > 0.01 ? dx / d : Math.cos(a.pose.yaw);
				const nz = d > 0.01 ? dz / d : Math.sin(a.pose.yaw);
				const k = (min - d) / 2;
				push.get(ia)!.add(new Vector3(-nx * k, 0, -nz * k));
				push.get(ib)!.add(new Vector3(nx * k, 0, nz * k));
			}
		for (const [id, o] of list) {
			const off = offsets.get(id) ?? offsets.set(id, new Vector3()).get(id)!;
			off.lerp(push.get(id)!, Math.min(1, dt * 4));
			o.group.position.x += off.x;
			o.group.position.z += off.z;
			o.pose.pos.x += off.x;
			o.pose.pos.z += off.z;
		}
	}

	/** Something solid at world point (x, y, z) a camera could not see through: bridge, seawall, building, pier. */
	function wall(x: number, y: number, z: number, col: NonNullable<City['collide']>): boolean {
		const [mx, my] = toMap(x, z);
		if (underBridge(mx, my) && y < roadY(mx, bridgeCentreY(mx)) + 1) return true;
		if (onLand(mx, my) && y < LAND_Y + 3) return true;
		if (col.deck(x, z) && y < LAND_Y + 1) return true;
		return col.solid(x, z) && y < col.roof(x, z, 1);
	}

	/**
	 * How far the chase camera at this yaw sees, in metres, before a wall: from the camera through the
	 * unit and on past it. Under dist + 8 means a wall fills the frame just behind the unit.
	 */
	function openView(ux: number, uz: number, yaw: number, dist: number, high: number, col: NonNullable<City['collide']>): number {
		const fx = Math.cos(yaw);
		const fz = Math.sin(yaw);
		const cx = ux - fx * dist;
		const cz = uz - fz * dist;
		const reach = dist + 14;
		for (let s = 0; s <= reach; s += 1) {
			// the sight line drops from camera height to the water past the unit
			const y = Math.max(0.4, high - (high * s) / reach + 0.4);
			if (wall(cx + fx * s, y, cz + fz * s, col)) return s;
		}
		return reach;
	}

	/** The yaw nearest to `from` whose view is open; the most open one if none is. */
	function bestYaw(ux: number, uz: number, from: number, dist: number, high: number, col: NonNullable<City['collide']>, need: number): number {
		let best = from;
		let bestScore = -Infinity;
		for (let k = 0; k < 24; k += 1) {
			for (const sgn of [1, -1]) {
				const yaw = from + sgn * (k / 24) * Math.PI;
				const v = openView(ux, uz, yaw, dist, high, col);
				const score = v >= need ? 1000 - k : v;
				if (score > bestScore) {
					bestScore = score;
					best = yaw;
				}
			}
			if (bestScore >= 1000 - k) break;
		}
		return best;
	}

	const angleTo = (a: number, b: number) => {
		let d = (b - a) % (Math.PI * 2);
		if (d > Math.PI) d -= Math.PI * 2;
		if (d < -Math.PI) d += Math.PI * 2;
		return d;
	};

	useTask((dt) => {
		dt = Math.min(dt, 0.1);
		t += dt;
		if (water) water.uniforms.uTime.value = t;
		const col = city?.collide ?? null;
		for (const [id, obj] of units) {
			const u = world.units[id];
			if (u) obj.update(u, t, dt, col);
		}
		separate(dt);
		const id = world.focus && units.has(world.focus) ? world.focus : units.has('jet_ski') ? 'jet_ski' : '';
		const obj = units.get(id);
		const u = world.units[id];
		if (!obj || !u || !camera) return;
		const rig = RIG[obj.pose.kind];
		if (id !== lastFocus) {
			lastFocus = id;
			started = false;
		}
		const p = obj.pose;
		const moving = u.moving && p.speed > 0.5;
		idleFor = moving ? 0 : idleFor + dt;
		const wetCam = obj.pose.kind === 'jetski' || obj.pose.kind === 'boat';
		if (!started) camYaw = p.yaw;
		if (idleFor > 2.5) {
			// slow orbit while it waits, but never round to a view that a wall, the bridge or the
			// seawall fills: if the next step would, swing to the nearest open view instead
			const d0 = rig.dist * (expanded ? 1 : 1.15);
			const needView = d0 + 8;
			if (!wetCam || !col || openView(p.pos.x, p.pos.z, camYaw + dt * 0.12, d0, rig.high, col) >= needView) camYaw += dt * 0.12;
			else {
				const best = bestYaw(p.pos.x, p.pos.z, camYaw, d0, rig.high, col, needView);
				camYaw += angleTo(camYaw, best) * Math.min(1, dt * 1.5);
			}
		} else camYaw += angleTo(camYaw, p.yaw) * Math.min(1, dt * 2.2);
		const fx = Math.cos(camYaw);
		const fz = Math.sin(camYaw);
		const rx = -fz;
		const rz = fx;
		const speedK = obj.pose.kind === 'person' ? 0 : Math.min(1, p.speed / 40);
		const dist = rig.dist * (expanded ? 1 : 1.15) + speedK * 1.2;
		want.set(p.pos.x - fx * dist + rx * rig.side, p.pos.y + rig.high + speedK * 0.4, p.pos.z - fz * dist + rz * rig.side);
		// how far the camera was pulled in toward the unit (1 = not at all)
		let pull = 1;
		// never inside a building: pull the camera in along the line to the unit until it is clear
		if (col) {
			const bx = p.pos.x;
			const bz = p.pos.z;
			let k = 1;
			const wet = wetCam;
			const blocked = (cx: number, cz: number) => {
				if (col.solid(cx, cz, 0.6)) return true;
				if (!wet) return false;
				// a boat camera stays over the water and out from under the bridge, or a wall hides the boat
				const [qx, qy] = toMap(cx, cz);
				return onLand(qx, qy) || underBridge(qx, qy, 4) || col.deck(cx, cz);
			};
			while (k > 0.25 && blocked(bx + (want.x - bx) * k, bz + (want.z - bz) * k)) k -= 0.08;
			if (k < 1) {
				pull = k;
				want.x = bx + (want.x - bx) * k;
				want.z = bz + (want.z - bz) * k;
				want.y += (1 - k) * 2.5;
			}
		}
		// do not dip under the seawall or the road
		const [mx, my] = toMap(want.x, want.z);
		const floor = onLand(mx, my) ? LAND_Y + 0.9 : 0.9;
		if (want.y < floor) want.y = floor;
		// a camera pulled in close (and raised) must also aim closer, or the unit drops out the bottom of the frame
		const ahead = rig.ahead * pull;
		look.set(p.pos.x + fx * ahead + rx * rig.side * 0.6, p.pos.y + rig.look, p.pos.z + fz * ahead + rz * rig.side * 0.6);
		// rigid follow on position (the yaw carries the lag, like a game chase cam); only a
		// focus change blends, so the camera never trails metres behind a fast unit
		blend = started ? Math.min(1, blend + dt * 1.2) : 0;
		if (!started) {
			camPos.copy(want);
			camLook.copy(look);
			started = true;
			blend = 1;
		} else if (blend < 1) {
			const k = 1 - Math.exp(-dt * 5);
			camPos.lerp(want, k);
			camLook.lerp(look, k);
		} else {
			camPos.y += (want.y - camPos.y) * Math.min(1, dt * 6);
			camPos.x = want.x;
			camPos.z = want.z;
			camLook.copy(look);
		}
		camera.position.copy(camPos);
		camera.lookAt(camLook);
		// ?lab3d only: a fixed camera offset from the followed unit, for screenshot scripts
		const lab = LAB ? (window as unknown as { __cam?: [number, number, number] }).__cam : undefined;
		if (lab) {
			camera.position.set(p.pos.x + lab[0], p.pos.y + lab[1], p.pos.z + lab[2]);
			camera.lookAt(p.pos.x, p.pos.y + 0.9, p.pos.z);
		}
		const fov = rig.fov + speedK * 8;
		if (Math.abs(camera.fov - fov) > 0.05) {
			camera.fov += (fov - camera.fov) * Math.min(1, dt * 2);
			camera.updateProjectionMatrix();
		}
		// shadows follow the action
		sunTarget.position.set(p.pos.x, p.pos.y, p.pos.z);
		sun.position.set(p.pos.x + SUN.x * 150, p.pos.y + SUN.y * 150, p.pos.z + SUN.z * 150);
		sunTarget.updateMatrixWorld();
	});
</script>

<T.PerspectiveCamera makeDefault fov={56} near={0.2} far={2600} oncreate={(ref) => { camera = ref; }} />
<T is={hemi} />
<T is={sun} />
<T is={sunTarget} />
<T is={root} />
