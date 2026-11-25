"""Channel 6 tool calling: what the caller can say, what Sky Seven does with it, and that the
browser's matcher (web/src/lib/scanner/sky.ts) gives exactly the same answers as sky.py."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import channels  # noqa: E402
import live  # noqa: E402
import sky  # noqa: E402

HEARD = [
    ("Coquina Row", "coquina_row"),
    ("fly over Coquina Row", "coquina_row"),
    ("go to Mango Heights", "mango_heights"),
    ("mango hights", "mango_heights"),
    ("Ibis Field", "ibis_field"),
    ("the airport", "ibis_field"),
    ("the marina", "heron_marina"),
    ("Palm Causeway", "palm_causeway"),
    ("palm causway", "palm_causeway"),
    ("the bridge", "palm_causeway"),
    ("downtown", "coral_court"),
    ("Conch Ave", "conch_ave"),
    ("Conch Avenue", "conch_ave"),
    ("Hibiscus St", "hibiscus_st"),
    ("Marlin Parkway", "marlin_pkwy"),
    ("Mangrove Avenue", "mangrove_ave"),
    ("Seagrape Expressway", "seagrape_expy"),
    ("the lighthouse", "lighthouse_point"),
    ("Flamingo Strip", "flamingo_strip"),
    ("Old Quay", "old_quay"),
    ("Gator Flats", "gator_flats"),
    ("Heron Bay", "heron_bay"),
    ("Sandbar Inlet", "sandbar_inlet"),
    ("Cypress Toll", "cypress_toll"),
    ("Orange Grove", "orange_grove"),
    ("Banyan Park", "banyan_park"),
    ("Tarpon Boulevard", "tarpon_blvd"),
    ("palm_causeway", "palm_causeway"),
]
UNKNOWN = ["Ocean Drive", "Little Havana", "Biscayne Boulevard", "Times Square", "", "the moon"]
UNITS = [("the jet ski", "jet_ski"), ("jetski", "jet_ski"), ("Marine Two", "marine_two"), ("the police boat", "marine_two"),
         ("Cab 41", "cab_41"), ("unit 23", "unit_23"), ("Big Wes", "big_wes"), ("the wedding guest", "wedding_guest"),
         ("sergeant holt", "sgt_holt"), ("cab nine", "cab_9")]
SPEECH = [
    ("Copy, heading to Coquina Row.", ("fly_to", "coquina_row")),
    ("Roger, swinging over to Mango Heights now.", ("fly_to", "mango_heights")),
    ("On my way to the marina, folks.", ("fly_to", "heron_marina")),
    ("Copy that, bringing her over Conch Avenue.", ("fly_to", "conch_ave")),
    ("Following the jet ski, hang on.", ("follow", "jet_ski")),
    ("Circling Ibis Field for you.", ("circle", "ibis_field")),
    ("Spotlight on.", ("spotlight", True)),
    ("Killing the spotlight.", ("spotlight", False)),
    ("Who is this on my frequency? This is a live news feed.", None),
    ("I am going to need a coffee.", None),
    ("Never heard of Ocean Drive. Nearest I have is Open Water.", None),
]
CALLS = [
    ("fly_to", {"place": "Coquina Row"}, [476, 620]),
    ("fly_to", {"place": "Ocean Drive"}, [476, 620]),
    ("fly_to", {"place": "Little Havana"}, [650, 756]),
    ("circle", {"place": "ibis field"}, None),
    ("follow", {"unit": "the jet ski"}, None),
    ("follow", {"unit": "a submarine"}, None),
    ("spotlight", {"on": True}, None),
    ("spotlight", {"on": "off"}, None),
    ("report", {}, None),
    ("move_unit", {"unit_id": "jet_ski"}, None),
    ("fly_to", "not an object", None),
]


@pytest.mark.parametrize(("heard", "want"), HEARD)
def test_every_name_on_the_map_resolves(heard: str, want: str) -> None:
    r = sky.resolve_place(heard)
    assert r["ok"] and r["id"] == want, r


@pytest.mark.parametrize("heard", UNKNOWN)
def test_an_unknown_street_comes_back_with_a_real_suggestion(heard: str) -> None:
    r = sky.resolve_place(heard, near=(650, 756))
    assert not r["ok"]
    assert r["suggest_id"] in sky.spots() and r["suggest"] == sky.spots()[r["suggest_id"]]["name"]


def test_suggestion_is_the_closest_sounding_name_then_the_nearest_spot() -> None:
    assert sky.resolve_place("Ocean Drive")["suggest_id"] == "open_water"
    assert sky.resolve_place("Biscayne Boulevard")["suggest_id"] == "tarpon_blvd"
    # nothing sounds close: the spot nearest the chopper
    assert sky.resolve_place("Times Square", near=(650, 756))["suggest_id"] == "coquina_row"


@pytest.mark.parametrize(("heard", "want"), UNITS)
def test_units_resolve(heard: str, want: str) -> None:
    r = sky.resolve_unit(heard)
    assert r["ok"] and r["id"] == want, r


@pytest.mark.parametrize(("text", "want"), SPEECH)
def test_the_pilots_own_words_become_an_order(text: str, want) -> None:
    got = sky.intent_from_speech(text)
    if want is None:
        assert got is None, got
    else:
        tool, arg = want
        assert got and got["tool"] == tool
        assert list(got["args"].values())[0] == arg


def test_spot_coordinates_are_on_the_map_and_names_unique() -> None:
    s = sky.spots()
    assert set(channels.PLACES) <= set(s)
    names = [str(v["name"]).lower() for v in s.values()]
    assert len(names) == len(set(names))
    for v in s.values():
        assert 0 <= float(v["x"]) <= 1200 and 0 <= float(v["y"]) <= 900


def test_dispatch_meaning() -> None:
    assert sky.dispatch("fly_to", {"place": "Coquina Row"})["id"] == "coquina_row"
    assert sky.dispatch("circle", {"place": "Ibis Field"})["id"] == "ibis_field"
    assert sky.dispatch("follow", {"unit": "the jet ski"})["id"] == "jet_ski"
    assert sky.dispatch("spotlight", {"on": "off"})["on"] is False
    assert sky.dispatch("report", {})["ok"]
    assert sky.dispatch("move_unit", {})["ok"] is False
    assert sky.dispatch("fly_to", "junk")["ok"] is False


def test_hydra_session_declares_the_five_tools_and_the_names() -> None:
    cfg = live.session_config()
    tools = {t["name"]: t for t in cfg["tools"]}
    assert set(tools) == set(sky.TOOLS)
    assert tools["fly_to"]["parameters"]["required"] == ["place"]
    assert tools["follow"]["parameters"]["required"] == ["unit"]
    assert tools["spotlight"]["parameters"]["properties"]["on"]["type"] == "boolean"
    text = cfg["instructions"]
    for name in ("Coquina Row", "Mango Heights", "Ibis Field", "Conch Avenue", "Marlin Parkway"):
        assert name in text
    assert "copy, heading to Coquina Row" in text
    assert "suggest" in text and "Only say you are going somewhere if you called the tool" in text


def test_payload_ships_the_table_without_anything_secret() -> None:
    table = channels.public_payload()["sky"]
    assert set(table["spots"]) == set(sky.spots())
    raw = json.dumps(table)
    for bad in ("sk_", "wat_", "api_key", "smallest_api", "bearer"):
        assert bad not in raw.lower()


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_browser_matcher_matches_python_exactly() -> None:
    cases = {
        "table": sky.public_table(),
        "places": [[h, [476, 620]] for h, _ in HEARD] + [[h, [650, 756]] for h in UNKNOWN] + [[h, None] for h in UNKNOWN],
        "units": [h for h, _ in UNITS] + ["a submarine", ""],
        "speech": [t for t, _ in SPEECH],
        "calls": [list(c) for c in CALLS],
        "ratios": [["coquina rw", "coquina row"], ["ocean dr", "ocean"], ["abc", ""], ["mango hights", "mango heights"], ["aaab", "abaa"]],
    }
    proc = subprocess.run(
        ["node", str(ROOT / "tests/js/sky_parity.mjs")],
        input=json.dumps(cases), capture_output=True, text=True, timeout=60, check=False,
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    js = json.loads(proc.stdout)
    py_places = [sky.resolve_place(h, tuple(n) if n else None) for h, n in cases["places"]]
    assert js["places"] == py_places
    assert js["units"] == [sky.resolve_unit(h) for h in cases["units"]]
    assert js["speech"] == [sky.intent_from_speech(t) for t in cases["speech"]]
    assert js["calls"] == [sky.dispatch(n, a, tuple(near) if near else None) for n, a, near in CALLS]
    from difflib import SequenceMatcher

    for (a, b), r in zip(cases["ratios"], js["ratios"]):
        assert abs(SequenceMatcher(None, a, b).ratio() - r) < 1e-12, (a, b)
