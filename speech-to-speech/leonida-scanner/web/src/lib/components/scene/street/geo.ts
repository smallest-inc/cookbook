/** A tiny mesh builder: quads and boxes into one BufferGeometry, with uv and vertex colour. */
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';

type V3 = [number, number, number];
const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpN = new Vector3();

export class Geo {
	pos: number[] = [];
	nor: number[] = [];
	uv: number[] = [];
	col: number[] = [];

	/** p0..p3 go round the quad; n is the side it should face. Winding is fixed up to match n. */
	quad(p: [V3, V3, V3, V3], n: V3, uvs: [number, number][], color: Color | string = '#ffffff') {
		const c = typeof color === 'string' ? new Color(color) : color;
		tmpA.set(p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]);
		tmpB.set(p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]);
		tmpN.crossVectors(tmpA, tmpB);
		const flip = tmpN.x * n[0] + tmpN.y * n[1] + tmpN.z * n[2] < 0;
		const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
		for (const i of order) {
			this.pos.push(p[i][0], p[i][1], p[i][2]);
			this.nor.push(n[0], n[1], n[2]);
			this.uv.push(uvs[i][0], uvs[i][1]);
			this.col.push(c.r, c.g, c.b);
		}
	}

	/**
	 * Box standing on y = base, centred on (x, z), turned by rot about Y. Side uv in metres divided
	 * by the tile size; the top gets one fixed uv so a facade texture shows plain wall up there.
	 */
	box(
		x: number,
		base: number,
		z: number,
		w: number,
		h: number,
		d: number,
		rot: number,
		color: Color | string,
		tile: [number, number] = [1, 1],
		opts: { top?: boolean; bottom?: boolean; topUv?: [number, number]; vOffset?: number } = {}
	) {
		const c = Math.cos(rot);
		const s = Math.sin(rot);
		const P = (lx: number, ly: number, lz: number): V3 => [x + lx * c + lz * s, base + ly, z - lx * s + lz * c];
		const N = (lx: number, lz: number): V3 => [lx * c + lz * s, 0, -lx * s + lz * c];
		const hw = w / 2;
		const hd = d / 2;
		const [tu, tv] = tile;
		const v0 = opts.vOffset ?? 0;
		const side = (a: V3, b: V3, len: number, n: V3) => {
			const u1 = len / tu;
			const vt = v0 + h / tv;
			this.quad([a, b, [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]]], n, [
				[0, v0],
				[u1, v0],
				[u1, vt],
				[0, vt]
			], color);
		};
		side(P(-hw, 0, hd), P(hw, 0, hd), w, N(0, 1));
		side(P(hw, 0, -hd), P(-hw, 0, -hd), w, N(0, -1));
		side(P(hw, 0, hd), P(hw, 0, -hd), d, N(1, 0));
		side(P(-hw, 0, -hd), P(-hw, 0, hd), d, N(-1, 0));
		const tuv = opts.topUv ?? [0.02, 0.02];
		if (opts.top !== false)
			this.quad([P(-hw, h, -hd), P(hw, h, -hd), P(hw, h, hd), P(-hw, h, hd)], [0, 1, 0], [tuv, tuv, tuv, tuv], color);
		if (opts.bottom)
			this.quad([P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd)], [0, -1, 0], [tuv, tuv, tuv, tuv], color);
	}

	/** Upright cylinder without caps, from y0 to y1. */
	cyl(x: number, z: number, y0: number, y1: number, r: number, color: Color | string, seg = 8) {
		for (let i = 0; i < seg; i += 1) {
			const a0 = (i / seg) * Math.PI * 2;
			const a1 = ((i + 1) / seg) * Math.PI * 2;
			const am = (a0 + a1) / 2;
			this.quad(
				[
					[x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r],
					[x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r],
					[x + Math.cos(a1) * r, y1, z + Math.sin(a1) * r],
					[x + Math.cos(a0) * r, y1, z + Math.sin(a0) * r]
				],
				[Math.cos(am), 0, Math.sin(am)],
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				],
				color
			);
		}
	}

	get empty() {
		return this.pos.length === 0;
	}

	build(): BufferGeometry {
		const g = new BufferGeometry();
		g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
		g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
		g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
		g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
		g.computeBoundingSphere();
		return g;
	}
}
