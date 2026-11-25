"""Plain-Python model of the water-side geometry the 3D view draws, read straight from the TS sources.

Land comes from the SVG paths in components/map/geometry.ts (with the marina notch from space.ts),
the bridge and its piers from space.ts and the road graph in world.svelte.ts, the low decks from the
road graph. Used by tests/test_water_clearance.py. Map units (1 = 0.3 m).
"""

from __future__ import annotations

import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web/src/lib"
GEOM = (WEB / "components/map/geometry.ts").read_text()
SPACE = (WEB / "components/scene/street/space.ts").read_text()
WORLD = (WEB / "scanner/world.svelte.ts").read_text()

S = 0.3
LAND_Y = 1.6
ROAD_W = 9.0
BRIDGE = ((812.0, 440.0), (900.0, 432.0), (992.0, 428.0))


def _const_str(src: str, name: str) -> str:
    m = re.search(rf"export const {name} =\s*'([^']+)'", src)
    assert m, name
    return m[1]


def _path_points(d: str, div: int = 24) -> list[tuple[float, float]]:
    toks = re.findall(r"[MLCZ]|-?\d+(?:\.\d+)?", d)
    pts: list[tuple[float, float]] = []
    i, cmd, cur = 0, "", (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in "MLCZ":
            cmd = t
            i += 1
            if t == "Z":
                continue
            continue
        if cmd in "ML":
            cur = (float(toks[i]), float(toks[i + 1]))
            pts.append(cur)
            i += 2
        elif cmd == "C":
            p1 = (float(toks[i]), float(toks[i + 1]))
            p2 = (float(toks[i + 2]), float(toks[i + 3]))
            p3 = (float(toks[i + 4]), float(toks[i + 5]))
            for k in range(1, div + 1):
                u = k / div
                a, b, c, e = (1 - u) ** 3, 3 * (1 - u) ** 2 * u, 3 * (1 - u) * u * u, u**3
                pts.append((a * cur[0] + b * p1[0] + c * p2[0] + e * p3[0], a * cur[1] + b * p1[1] + c * p2[1] + e * p3[1]))
            cur = p3
            i += 6
        else:
            raise ValueError(cmd)
    return pts


def _notched() -> str:
    m = re.search(r"mainlandNotched = g\.mainland\.replace\('([^']+)', '([^']+)'\)", SPACE)
    assert m
    return _const_str(GEOM, "mainland").replace(m[1], m[2])


POLYS = [_path_points(_notched()), _path_points(_const_str(GEOM, "islandNorth")), _path_points(_const_str(GEOM, "islandSouth"))]


def _in_poly(pts, x, y) -> bool:
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def seg_dist(p, a, b) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t)


def on_land(x: float, y: float) -> bool:
    return any(_in_poly(p, x, y) for p in POLYS)


def shore_dist(x: float, y: float) -> float:
    """Distance to the nearest seawall (negative on land)."""
    d = min(seg_dist((x, y), p[i - 1], p[i]) for p in POLYS for i in range(1, len(p)))
    return -d if on_land(x, y) else d


def nodes(name: str) -> dict[str, tuple[float, float]]:
    a = WORLD.index(f"export const {name}")
    b = WORLD.index("};", a)
    return {m[1]: (float(m[2]), float(m[3])) for m in re.finditer(r"(\w+): \[(-?\d+), (-?\d+)\]", WORLD[a:b])}


def edges(name: str) -> list[tuple[str, str]]:
    a = WORLD.index(f"export const {name}")
    b = WORLD.index("];", a)
    return re.findall(r"\['(\w+)', '(\w+)'\]", WORLD[a:b])


def loops() -> dict[str, tuple[float, float, float]]:
    a = WORLD.index("export const WATER_LOOPS")
    b = WORLD.index("};", a)
    return {m[1]: (float(m[2]), float(m[3]), float(m[4])) for m in re.finditer(r"(\w+): \[(\d+), (\d+), (\d+)\]", WORLD[a:b])}


def channel() -> tuple[float, float]:
    m = re.search(r"BRIDGE_CHANNEL: \[number, number\] = \[(\d+), (\d+)\]", SPACE)
    assert m, "space.ts must export BRIDGE_CHANNEL"
    return float(m[1]), float(m[2])


def bridge_centre_y(x: float) -> float:
    (x0, y0), (x1, y1), (x2, y2) = BRIDGE
    if x <= x1:
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return y1 + (y2 - y1) * (x - x1) / (x2 - x1)


def road_y(x: float) -> float:
    t = min(1.0, max(0.0, (x - 812) / 180))
    return LAND_Y + 5.2 * math.sin(math.pi * t)


BRIDGE_HALF = (ROAD_W / 2 + 0.5) / S  # deck plus parapet, map units


def under_bridge(x: float, y: float, pad: float = 0.0) -> bool:
    return 812 - pad <= x <= 992 + pad and abs(y - bridge_centre_y(min(992, max(812, x)))) < BRIDGE_HALF + pad


def piers() -> list[tuple[float, float]]:
    """Pier centres, the same t steps city.ts uses, minus the navigation channel."""
    c0, c1 = channel()
    out = []
    for a, b in ((BRIDGE[0], BRIDGE[1]), (BRIDGE[1], BRIDGE[2])):
        t = 0.12
        while t < 0.95:
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            if not (c0 <= x <= c1):
                out.append((x, y))
            t += 0.19
    return out


def pier_dist(p) -> float:
    """Distance from p to the nearest pier box (1.6 m along the road, 7.2 m across)."""
    best = math.inf
    for cx, cy in piers():
        ax, ay = 0.8 / S, ROAD_W * 0.8 / 2 / S
        dx, dy = max(0.0, abs(p[0] - cx) - ax), max(0.0, abs(p[1] - cy) - ay)
        best = min(best, math.hypot(dx, dy))
    return best


def low_decks() -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """Road segments over water a hull cannot pass under: piers, and the low ends of the bridge."""
    land = nodes("LAND_NODES")
    out = []
    bridge = {"bridge_w", "palm_causeway", "bridge_e"}
    for a, b in edges("LAND_EDGES"):
        A, B = land[a], land[b]
        for i in range(40):
            t0, t1 = i / 40, (i + 1) / 40
            P = (A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0)
            Q = (A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1)
            mid = ((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2)
            if on_land(*mid):
                continue
            low = road_y(mid[0]) < LAND_Y + 3 if (a in bridge and b in bridge) else True
            if low:
                out.append((P, Q))
    return out
