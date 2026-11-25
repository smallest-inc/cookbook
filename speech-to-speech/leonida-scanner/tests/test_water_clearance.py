"""Hulls never touch the shore, the low decks, the bridge piers or sit under the bridge.

Checks every water waypoint, every hold point, every point along every water edge and every point
of every circling loop, against the same geometry the 3D view builds (see waterlib.py), with the
hull's own half length plus a margin. This is the check for "the jet ski is half inside the wall at
Palm Causeway": the old Palm Causeway water node sat on the bridge's centre line.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import waterlib as W  # noqa: E402

# half length plus 0.5 m, in map units (1 = 0.3 m)
JET_SKI = (1.6 + 0.4) / W.S
BOAT = (4.5 + 0.5) / W.S
DECK_HALF = (4.5 + 1.0) / W.S  # road half width plus curb and parapet
# only the jet ski uses its slip; Marine Two stops at the basin mouth (planRoute)
JET_SKI_ONLY = {"heron_marina"}

NODES = W.nodes("WATER_NODES")
EDGES = W.edges("WATER_EDGES")
DECKS = W.low_decks()


def clearance(p: tuple[float, float], hold: bool) -> float:
    c = min(
        W.shore_dist(*p),
        min(W.seg_dist(p, a, b) for a, b in DECKS) - DECK_HALF,
        W.pier_dist(p),
    )
    if hold and 812 <= p[0] <= 992:
        # a hull that stops must be beside the bridge, not under it
        c = min(c, abs(p[1] - W.bridge_centre_y(p[0])) - W.BRIDGE_HALF)
    return c


def need(*ids: str) -> float:
    return JET_SKI if any(i in JET_SKI_ONLY for i in ids) else BOAT


def test_every_hold_point_is_open_water():
    for nid, p in NODES.items():
        c = clearance(p, hold=True)
        assert c >= need(nid), f"{nid} {p} has {c * W.S:.1f} m clear, needs {need(nid) * W.S:.1f} m"


def test_every_water_edge_is_clear_end_to_end():
    for a, b in EDGES:
        A, B = NODES[a], NODES[b]
        for i in range(81):
            t = i / 80
            p = (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)
            c = clearance(p, hold=False)
            assert c >= need(a, b), f"{a}-{b} at {p}: {c * W.S:.1f} m clear"


def test_crossing_under_the_bridge_uses_the_channel_with_headroom():
    c0, c1 = W.channel()
    crossings = 0
    for a, b in EDGES:
        A, B = NODES[a], NODES[b]
        for i in range(201):
            t = i / 200
            p = (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)
            if W.under_bridge(*p):
                crossings += 1
                assert c0 + BOAT * 0.5 <= p[0] <= c1 - BOAT * 0.5, (a, b, p)
                # deck underside 1.2 m below the road; Marine Two stands about 3 m tall
                assert W.road_y(p[0]) - 1.2 >= 3.5, (a, b, p)
    assert crossings, "the bay should still connect north and south under the bridge"


def test_circling_loops_stay_in_open_water():
    loops = W.loops()
    assert "palm_causeway" in loops
    for pid, (cx, cy, r) in loops.items():
        assert pid in NODES, pid
        for k in range(72):
            a = k / 72 * 2 * math.pi
            p = (cx + r * math.cos(a), cy + r * math.sin(a))
            assert clearance(p, hold=True) >= BOAT, f"loop {pid} at {p}"


def test_palm_causeway_hold_is_beside_the_bridge():
    p = NODES["palm_causeway"]
    gap = abs(p[1] - W.bridge_centre_y(p[0])) - W.BRIDGE_HALF
    # close enough to frame the causeway, far enough that the deck never fills the camera
    assert 8 / W.S <= gap <= 20 / W.S, gap * W.S
    assert not W.under_bridge(*p, pad=BOAT)


def test_bridge_piers_leave_the_channel_open():
    c0, c1 = W.channel()
    assert c1 - c0 >= 2 * BOAT + 4 / W.S
    assert all(not (c0 <= x <= c1) for x, _ in W.piers())
    assert len(W.piers()) >= 6
