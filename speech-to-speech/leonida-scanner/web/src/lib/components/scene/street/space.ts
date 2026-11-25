/**
 * Street scale. The map sheet is 1200 x 900 map units; in the street view one map unit is S metres,
 * so the sim's speeds read as a jog for walkers and city traffic speed for cars. Water is y = 0,
 * land and roads stand LAND_Y above it behind a seawall, like a canal city.
 */
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as g from '../../map/geometry';

export const S = 0.3;
export const CX = 600;
export const CY = 450;
export const LAND_Y = 1.6;
export const ROAD_W = 9;
export const WALK_W = 3;

export const toW = (x: number, y: number): [number, number] => [(x - CX) * S, (y - CY) * S];
export const toMap = (wx: number, wz: number): [number, number] => [wx / S + CX, wz / S + CY];

const loader = new SVGLoader();
const svg = (d: string) => `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

/** Points of an SVG path in map space. */
export function pathPoints(d: string, div = 24): [number, number][] {
	const data = loader.parse(svg(d));
	return data.paths.flatMap((p) => p.subPaths.flatMap((sp) => sp.getPoints(div).map((v) => [v.x, v.y] as [number, number])));
}

export function shapesOf(d: string) {
	const data = loader.parse(svg(d));
	return data.paths.flatMap((p) => SVGLoader.createShapes(p));
}

/** The mainland with the marina basin cut in as a notch, so the basin is real water. */
export const mainlandNotched = g.mainland.replace('C804,480 814,520 806,545 L806,605', 'C804,480 814,520 806,540 L744,540 L744,606 L806,606');

const polys = [pathPoints(mainlandNotched, 12), pathPoints(g.islandNorth, 16), pathPoints(g.islandSouth, 8)];

function inPoly(pts: [number, number][], x: number, y: number): boolean {
	let inside = false;
	for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
		const [xi, yi] = pts[i];
		const [xj, yj] = pts[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

/** Map-space point on dry land. */
export const onLand = (x: number, y: number) => polys.some((p) => inPoly(p, x, y));

/** The causeway bridge runs from map x 812 to 992 over open water, arched so boats pass under. */
const BRIDGE_X0 = 812;
const BRIDGE_X1 = 992;
export const BRIDGE_RISE = 5.2;
export const onBridge = (x: number, y: number) => x > BRIDGE_X0 - 0.5 && x < BRIDGE_X1 + 0.5 && Math.abs(y - 435) < 14;

/** Map x range in the middle of the span with no piers: the navigation channel under the arch. */
export const BRIDGE_CHANNEL: [number, number] = [878, 926];
const BRIDGE_PTS: [number, number][] = [
	[812, 440],
	[900, 432],
	[992, 428]
];
/** Map y of the bridge's centre line at map x (the deck runs between the three bridge nodes). */
export function bridgeCentreY(x: number): number {
	const [[x0, y0], [x1, y1], [x2, y2]] = BRIDGE_PTS;
	const cx = Math.min(x2, Math.max(x0, x));
	return cx <= x1 ? y0 + ((y1 - y0) * (cx - x0)) / (x1 - x0) : y1 + ((y2 - y1) * (cx - x1)) / (x2 - x1);
}
/** Half the bridge's width (deck and parapet) in map units. */
export const BRIDGE_HALF = (ROAD_W / 2 + 0.5) / S;
/** Map point under (or within pad of) the bridge deck's footprint. */
export const underBridge = (x: number, y: number, pad = 0) => x >= BRIDGE_X0 - pad && x <= BRIDGE_X1 + pad && Math.abs(y - bridgeCentreY(x)) < BRIDGE_HALF + pad;

/** Road surface height under a map point (land roads are flat, the bridge is an arch). */
export function roadY(x: number, y: number): number {
	if (!onBridge(x, y)) return LAND_Y;
	const t = (x - BRIDGE_X0) / (BRIDGE_X1 - BRIDGE_X0);
	return LAND_Y + BRIDGE_RISE * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
}

export const insideRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number, pad = 0) =>
	x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
