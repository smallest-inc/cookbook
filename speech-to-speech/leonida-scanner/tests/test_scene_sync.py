"""The 3D view follows what the radio says: every aired line maps to one unit, place and action.

Also pins the in-character "who is this" reaction to a caller on every channel, and that the
water routes stay clear of the low road decks the 3D city draws over the basin and the inlet.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import channels  # noqa: E402
import live  # noqa: E402
import server  # noqa: E402

ACTIONS = {"drive_to", "chase", "stop", "circle"}


def test_every_scripted_line_has_a_valid_scene():
    payload = channels.public_payload()
    for ch in payload["channels"]:
        for ln in ch["lines"]:
            sc = ln["scene"]
            assert sc["unit"] in channels.UNITS, (ch["id"], ln["i"])
            assert sc["place"] in channels.PLACES
            assert sc["action"] in ACTIONS
            if "bg" in sc:
                assert sc["bg"]["unit"] in channels.UNITS


def test_scene_follows_the_unit_the_line_is_about():
    s = channels.line_scene
    assert s("metro", 0) == {"unit": "jet_ski", "place": "heron_marina", "action": "chase", "cue": True}
    assert s("metro", 2)["unit"] == "unit_14" and s("metro", 2)["action"] == "stop"
    assert s("harbor", 1)["unit"] == "marine_two"
    assert s("harbor", 2)["action"] == "circle"  # "a full lap around a pelican"
    assert s("sky7", 1)["unit"] == "mango_seller"  # "a guy is selling mangoes"
    # "Stay on him": the chopper over the jet ski, the mango seller only moves in the background
    four = s("sky7", 4)
    assert four["unit"] == "sky_seven" and four["place"] == "palm_causeway"
    assert four["bg"]["unit"] == "mango_seller"
    assert s("cabs", 5)["unit"] == "cab_9" and s("cabs", 5)["place"] == "ibis_field"
    assert s("cb19", 0)["unit"] == "big_wes"  # "one-nine" is not Cab Nine
    assert s("cb19", 3)["unit"] == "sky_seven"  # "that's the news chopper"


def test_a_line_that_names_a_unit_never_shows_a_different_one():
    for ch in channels.CHANNELS:
        for i, ln in enumerate(ch["lines"]):
            sc = channels.line_scene(ch["id"], i)
            named = channels.mentions(ln["text"])
            beat = (ch["id"], i) in channels.JET_SKI_BEATS
            own = channels.SPEAKER_UNIT.get((ch["id"], ln["speaker"]))
            if named and not beat:
                assert sc["unit"] in named | {own}, (ch["id"], i, sc, named)


def test_reply_scene_from_the_model_and_from_the_words():
    metro = channels.CHANNEL_BY_ID["metro"]
    raw = json.dumps(
        {
            "calls": [
                {"speaker": "dispatch", "text": "Unknown station, identify yourself.", "place": "banyan_park"},
                {
                    "speaker": "reyes",
                    "text": "Twenty-three, in pursuit down Coquina Row.",
                    "place": "coquina_row",
                    "unit": "unit_23",
                    "action": "chase",
                },
                {"speaker": "dispatch", "text": "Fourteen, hold at the toll.", "place": "cypress_toll", "unit": "nope"},
            ]
        }
    )
    calls = server._parse_calls(raw, metro)
    assert calls[1]["scene"] == {"unit": "unit_23", "place": "coquina_row", "action": "chase", "cue": False}
    # a bad unit id from the model falls back to the words: Fourteen, holding
    assert calls[2]["scene"]["unit"] == "unit_14" and calls[2]["scene"]["action"] == "stop"
    # the dispatcher is not a unit: the nearest metro car goes to the caller
    assert calls[0]["scene"]["unit"] in channels.channel_units("metro")
    assert calls[0]["scene"]["place"] == "banyan_park"


def test_every_channel_reacts_to_a_stranger_in_character():
    for ch in channels.CHANNELS:
        assert ch["intruder"], ch["id"]
        prompt = server.system_prompt(ch)
        assert ch["intruder"] in prompt
        assert "unknown civilian" in prompt
        first = ch["fallback"][0]["text"].lower()
        assert re.search(r"who is|identify|not one of my|stranger|station", first), (ch["id"], first)


def test_fallback_reply_carries_scenes(monkeypatch):
    def boom(*_a, **_k):
        raise RuntimeError("offline")

    monkeypatch.setattr(server, "_chat", boom)
    out = server.build_reply("cabs", "hello is this the taxi radio", [])
    assert out["source"] == "fallback"
    assert all(c["scene"]["unit"] in channels.UNITS for c in out["calls"])


def test_hydra_pilot_challenges_the_caller():
    text = live.instructions()
    assert "stranger" in text and "authorised" in text
    assert "cut off" in text


# ------------------------------------------------------------ water routes vs low decks
WORLD = (ROOT / "web/src/lib/scanner/world.svelte.ts").read_text()


def _nodes(name: str) -> dict[str, tuple[float, float]]:
    a = WORLD.index(f"export const {name}")
    b = WORLD.index("};", a)
    return {m[1]: (float(m[2]), float(m[3])) for m in re.finditer(r"(\w+): \[(-?\d+), (-?\d+)\]", WORLD[a:b])}


def _edges(name: str) -> list[tuple[str, str]]:
    a = WORLD.index(f"export const {name}")
    b = WORLD.index("];", a)
    return re.findall(r"\['(\w+)', '(\w+)'\]", WORLD[a:b])


def _seg(p, a, b) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy or 1)))
    return ((p[0] - a[0] - dx * t) ** 2 + (p[1] - a[1] - dy * t) ** 2) ** 0.5


def test_water_routes_stay_clear_of_low_road_decks():
    land, water = _nodes("LAND_NODES"), _nodes("WATER_NODES")
    bridge = {"bridge_w", "palm_causeway", "bridge_e"}
    for a, b in _edges("WATER_EDGES"):
        A, B = water[a], water[b]
        for i in range(41):
            t = i / 40
            p = (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)
            for x, y in _edges("LAND_EDGES"):
                if x in bridge and y in bridge and 0.15 < (p[0] - 812) / 180 < 0.85:
                    continue  # under the high middle of the causeway arch
                # road half width 4.5 m plus curb, plus a jet ski's half beam, in map units (0.3 m)
                assert _seg(p, land[x], land[y]) >= 20, (a, b, p, x, y)
