/**
 * Textures drawn in code on a canvas, so the street view needs no image files beyond the sky.
 * Everything here is original: asphalt grain, concrete, a deco facade bay, a glass curtain wall,
 * a palm frond and a loud shirt print.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return [c, c.getContext('2d')!];
}

/** Stable pseudo random, so textures look the same every load. */
export function rng(seed: number) {
	let s = seed >>> 0 || 1;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

function tex(c: HTMLCanvasElement, repeat = true, srgb = true): Texture {
	const t = new CanvasTexture(c);
	if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
	if (srgb) t.colorSpace = SRGBColorSpace;
	t.anisotropy = 8;
	return t;
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, light: string, dark: string, r: () => number, size = 1.6) {
	for (let i = 0; i < n; i += 1) {
		ctx.fillStyle = r() < 0.5 ? light : dark;
		ctx.globalAlpha = 0.18 + r() * 0.3;
		const s = 0.6 + r() * size;
		ctx.fillRect(r() * w, r() * h, s, s);
	}
	ctx.globalAlpha = 1;
}

export function asphalt(): Texture {
	const [c, x] = canvas(256, 256);
	const r = rng(7);
	x.fillStyle = '#55595e';
	x.fillRect(0, 0, 256, 256);
	// soft patches, then fine grain
	for (let i = 0; i < 26; i += 1) {
		x.fillStyle = r() < 0.5 ? '#4c5055' : '#5d6166';
		x.globalAlpha = 0.35;
		x.beginPath();
		x.ellipse(r() * 256, r() * 256, 20 + r() * 50, 10 + r() * 30, r() * 3, 0, Math.PI * 2);
		x.fill();
	}
	x.globalAlpha = 1;
	grain(x, 256, 256, 9000, '#7b7f84', '#35383c', r);
	// tyre wear down the lanes
	x.fillStyle = '#3f4246';
	x.globalAlpha = 0.18;
	for (const v of [0.18, 0.32, 0.68, 0.82]) x.fillRect(0, v * 256 - 6, 256, 12);
	x.globalAlpha = 1;
	return tex(c);
}

export function concrete(base = '#c9c6bf'): Texture {
	const [c, x] = canvas(256, 256);
	const r = rng(11);
	x.fillStyle = base;
	x.fillRect(0, 0, 256, 256);
	grain(x, 256, 256, 6000, '#e2e0da', '#a9a69f', r, 1.2);
	// slab joints
	x.strokeStyle = '#9d9a93';
	x.lineWidth = 2;
	for (let i = 0; i <= 256; i += 64) {
		x.beginPath();
		x.moveTo(i, 0);
		x.lineTo(i, 256);
		x.stroke();
		x.beginPath();
		x.moveTo(0, i);
		x.lineTo(256, i);
		x.stroke();
	}
	return tex(c);
}

export function seawall(): Texture {
	const [c, x] = canvas(256, 128);
	const r = rng(5);
	x.fillStyle = '#b9b6ae';
	x.fillRect(0, 0, 256, 128);
	grain(x, 256, 128, 4000, '#d4d1ca', '#8e8b84', r, 1.4);
	// wet line and algae near the water (v = 0 is the bottom of the wall)
	const g = x.createLinearGradient(0, 128, 0, 70);
	g.addColorStop(0, 'rgba(46,70,58,0.75)');
	g.addColorStop(1, 'rgba(46,70,58,0)');
	x.fillStyle = g;
	x.fillRect(0, 70, 256, 58);
	x.strokeStyle = 'rgba(80,78,72,0.6)';
	for (let i = 0; i < 256; i += 64) {
		x.beginPath();
		x.moveTo(i, 0);
		x.lineTo(i, 128);
		x.stroke();
	}
	return tex(c);
}

export function grass(): Texture {
	const [c, x] = canvas(256, 256);
	const r = rng(3);
	x.fillStyle = '#7f9f5a';
	x.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 40; i += 1) {
		x.fillStyle = r() < 0.5 ? '#8eac63' : '#6f8f4e';
		x.globalAlpha = 0.4;
		x.beginPath();
		x.ellipse(r() * 256, r() * 256, 18 + r() * 40, 12 + r() * 30, r() * 3, 0, Math.PI * 2);
		x.fill();
	}
	x.globalAlpha = 1;
	grain(x, 256, 256, 9000, '#a3bd78', '#5b7a3e', r, 1.4);
	return tex(c);
}

/** One bay (4 m) by one floor (3.6 m) of a deco block: white render, eyebrow shade, a window. */
export function decoBay(): Texture {
	const [c, x] = canvas(128, 128);
	const r = rng(21);
	x.fillStyle = '#f6f4ef';
	x.fillRect(0, 0, 128, 128);
	grain(x, 128, 128, 700, '#ffffff', '#dcd8cf', r, 1);
	// window, glass reflects the sky at the top
	const g = x.createLinearGradient(0, 34, 0, 98);
	g.addColorStop(0, '#9fc2d8');
	g.addColorStop(0.45, '#4f7c96');
	g.addColorStop(1, '#2d4a5c');
	x.fillStyle = g;
	x.fillRect(22, 34, 84, 64);
	// mullions
	x.fillStyle = '#e9e6df';
	x.fillRect(62, 34, 4, 64);
	x.fillRect(22, 58, 84, 3);
	// shade under the eyebrow ledge and a sill
	x.fillStyle = 'rgba(70,60,50,0.28)';
	x.fillRect(16, 26, 96, 8);
	x.fillStyle = '#e4e0d8';
	x.fillRect(18, 98, 92, 5);
	// floor line
	x.fillStyle = 'rgba(0,0,0,0.06)';
	x.fillRect(0, 124, 128, 4);
	return tex(c);
}

/** One panel of a glass tower: two panes and grey mullions. */
export function glassBay(): Texture {
	const [c, x] = canvas(128, 128);
	x.fillStyle = '#c7ced6';
	x.fillRect(0, 0, 128, 128);
	for (const [px, w] of [
		[4, 58],
		[66, 58]
	]) {
		const g = x.createLinearGradient(0, 0, 0, 128);
		g.addColorStop(0, '#8fb6d6');
		g.addColorStop(0.6, '#3f6688');
		g.addColorStop(1, '#2b4862');
		x.fillStyle = g;
		x.fillRect(px, 4, w, 112);
	}
	x.fillStyle = '#d8dee5';
	x.fillRect(0, 116, 128, 12);
	return tex(c);
}

/** A palm frond with leaflets, on transparent ground. Stem runs along u, from 0 (trunk) to 1 (tip). */
export function frond(): Texture {
	const [c, x] = canvas(512, 128);
	const r = rng(9);
	x.clearRect(0, 0, 512, 128);
	x.lineCap = 'round';
	for (let i = 0; i < 70; i += 1) {
		const t = 0.04 + (i / 70) * 0.94;
		const px = t * 512;
		const len = (1 - Math.pow(t - 0.35, 2) * 1.6) * 56 * (0.85 + r() * 0.3);
		for (const side of [-1, 1]) {
			const shade = 0.75 + r() * 0.35;
			x.strokeStyle = `rgb(${Math.round(70 * shade)},${Math.round(132 * shade)},${Math.round(52 * shade)})`;
			x.lineWidth = 3.2 + r() * 1.5;
			x.beginPath();
			x.moveTo(px, 64);
			x.quadraticCurveTo(px + 10, 64 + side * len * 0.5, px + 22 + r() * 6, 64 + side * len);
			x.stroke();
		}
	}
	x.strokeStyle = '#8a7a45';
	x.lineWidth = 4;
	x.beginPath();
	x.moveTo(0, 64);
	x.lineTo(505, 64);
	x.stroke();
	return tex(c, false);
}

export function bark(): Texture {
	const [c, x] = canvas(64, 256);
	const r = rng(4);
	x.fillStyle = '#9b8a6e';
	x.fillRect(0, 0, 64, 256);
	for (let y = 0; y < 256; y += 10) {
		x.fillStyle = r() < 0.5 ? '#857459' : '#ab9a7d';
		x.fillRect(0, y, 64, 3 + r() * 2);
	}
	grain(x, 64, 256, 800, '#bfae90', '#6c5d45', r, 1);
	return tex(c);
}

/** Loud short-sleeve shirt print: teal ground, cream and coral flowers, leaves. */
export function shirtPrint(): Texture {
	const [c, x] = canvas(256, 256);
	const r = rng(13);
	x.fillStyle = '#1f9a9a';
	x.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 26; i += 1) {
		const cx = r() * 256;
		const cy = r() * 256;
		x.fillStyle = '#167a73';
		x.beginPath();
		x.ellipse(cx + 10, cy + 6, 16, 5, r() * 3, 0, Math.PI * 2);
		x.fill();
		const col = r() < 0.5 ? '#f4efe0' : '#f08a6c';
		x.fillStyle = col;
		for (let p = 0; p < 5; p += 1) {
			const a = (p / 5) * Math.PI * 2;
			x.beginPath();
			x.ellipse(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 6, 3.5, a, 0, Math.PI * 2);
			x.fill();
		}
		x.fillStyle = '#f2c14e';
		x.beginPath();
		x.arc(cx, cy, 2.5, 0, Math.PI * 2);
		x.fill();
	}
	return tex(c);
}

/** Foam for the jet ski wake: bright in the middle, broken at the edges. v runs across the trail. */
export function foam(): Texture {
	const [c, x] = canvas(128, 64);
	const r = rng(17);
	x.fillStyle = 'rgba(255,255,255,0.55)';
	x.fillRect(0, 0, 128, 64);
	for (let i = 0; i < 700; i += 1) {
		x.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
		x.beginPath();
		x.arc(r() * 128, r() * 64, 1 + r() * 3.5, 0, Math.PI * 2);
		x.fill();
	}
	return tex(c, true, true);
}
