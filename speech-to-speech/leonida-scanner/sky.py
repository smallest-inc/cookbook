"""Sky Seven's airspace: every name the pilot can fly to, and how a heard name maps to one.

Channel 6 is a live Hydra voice. Hydra calls tools (fly_to, follow, circle, spotlight, report)
with the words it heard, and the browser runs them. This module is the single source of truth for
what those words can mean: the places, the streets and the districts on the Port Ibis map, their
spoken aliases, and the unit names. The browser gets the same table (public_table) and runs the
same matching (web/src/lib/scanner/sky.ts); tests/test_sky.py checks both agree.

Pure data and string matching. No network, no secrets.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from channels import PLACES, UNITS

# Streets, districts and water on the map that are not story places. x/y in map space (1200 x 900),
# on the street or over the middle of the district, so the chopper has something to look at.
EXTRA_SPOTS: dict[str, dict[str, object]] = {
    "seagrape_expy": {"name": "Seagrape Expressway", "x": 470, "y": 470, "aliases": ["seagrape", "the expressway", "the expy", "the highway", "the freeway"]},
    "conch_ave": {"name": "Conch Avenue", "x": 640, "y": 240, "aliases": ["conch", "conch street"]},
    "tarpon_blvd": {"name": "Tarpon Boulevard", "x": 660, "y": 620, "aliases": ["tarpon"]},
    "marlin_pkwy": {"name": "Marlin Parkway", "x": 420, "y": 760, "aliases": ["marlin", "marlin street"]},
    "hibiscus_st": {"name": "Hibiscus Street", "x": 540, "y": 520, "aliases": ["hibiscus"]},
    "mangrove_ave": {"name": "Mangrove Avenue", "x": 790, "y": 330, "aliases": ["mangrove"]},
    "heron_bay": {"name": "Heron Bay", "x": 905, "y": 330, "aliases": ["the bay", "over the water", "the harbour", "the harbor"]},
    "tarpon_river": {"name": "Tarpon River", "x": 380, "y": 592, "aliases": ["the river"]},
    "sawgrass_reach": {"name": "Sawgrass Reach", "x": 120, "y": 230, "aliases": ["sawgrass", "the everglades", "the glades", "the marsh"]},
    "cypress_groves": {"name": "Cypress Groves", "x": 362, "y": 92, "aliases": ["the groves", "the orange groves", "the orchards"]},
    "open_water": {"name": "Open Water", "x": 1120, "y": 470, "aliases": ["the ocean", "the sea", "offshore", "out to sea"]},
}

# Spoken ways to say a story place. The place's own name and id always count too.
PLACE_ALIASES: dict[str, list[str]] = {
    "heron_marina": ["the marina", "marina", "the slips", "the boat docks"],
    "palm_causeway": ["the causeway", "causeway", "the bridge", "palm bridge", "causeway bridge"],
    "sandbar_inlet": ["the inlet", "inlet", "sandbar", "the sandbar", "the pass"],
    "flamingo_strip": ["the strip", "flamingo", "the beach", "the boardwalk", "flamingo beach"],
    "lighthouse_point": ["the lighthouse", "lighthouse"],
    "coral_court": ["downtown", "coral", "the courthouse", "city centre", "city center"],
    "banyan_park": ["the park", "banyan"],
    "cypress_toll": ["the toll", "toll plaza", "the toll booth", "cypress toll plaza"],
    "orange_grove": ["the interchange", "orange grove", "the junction"],
    "mango_heights": ["mango", "the heights", "the suburbs"],
    "old_quay": ["the quay", "the port", "the docks", "the container yard", "old key"],
    "gator_flats": ["gator", "the flats", "the swamp", "alligator flats"],
    "ibis_field": ["the airport", "ibis", "the airfield", "the runway"],
    "coquina_row": ["coquina", "coquina road", "coquina street"],
}

UNIT_ALIASES: dict[str, list[str]] = {
    "jet_ski": ["jet ski", "jetski", "the jet ski", "the runaway", "the guy on the jet ski", "flamingo shirt"],
    "marine_two": ["marine two", "marine 2", "the police boat", "the patrol boat", "the boat"],
    "unit_23": ["unit 23", "unit twenty three", "reyes", "twenty three"],
    "unit_14": ["unit 14", "unit fourteen", "peck", "fourteen"],
    "sgt_holt": ["holt", "sergeant holt", "the sergeant", "the suv"],
    "cab_41": ["cab 41", "cab forty one", "forty one", "the taxi", "the cab"],
    "cab_9": ["cab 9", "cab nine"],
    "big_wes": ["big wes", "wes", "the truck", "the big rig"],
    "wedding_guest": ["the wedding guest", "wedding guest", "the bride", "the groom", "the guest"],
    "mango_seller": ["the mango seller", "mango seller", "mango guy", "the mango man"],
}

# Words that never decide a match on their own.
_FILLER = {
    "the", "a", "an", "over", "to", "of", "on", "at", "by", "up", "down", "near", "around",
    "please", "now", "sky", "seven", "go", "fly", "head", "heading", "take", "us", "me", "can", "you",
}
_SUFFIX = {"street": "st", "st": "st", "avenue": "ave", "ave": "ave", "boulevard": "blvd", "blvd": "blvd",
           "parkway": "pkwy", "pkwy": "pkwy", "road": "rd", "rd": "rd", "drive": "dr", "dr": "dr",
           "expressway": "expy", "expy": "expy", "lane": "ln", "ln": "ln"}

_SUFFIXES = set(_SUFFIX.values())

# Above this the heard name is that spot. Between SUGGEST and MATCH it is a guess worth offering.
MATCH = 0.82
SUGGEST = 0.5

TOOLS = ("fly_to", "follow", "circle", "spotlight", "report")


def norm(text: str) -> str:
    """lowercase, digits kept, punctuation gone, street suffixes shortened, one space."""
    t = re.sub(r"[^a-z0-9 ]+", " ", str(text).lower().replace("_", " "))
    words = [_SUFFIX.get(w, w) for w in t.split()]
    return " ".join(words)


def _core(text: str) -> str:
    return " ".join(w for w in norm(text).split() if w not in _FILLER)


def spots() -> dict[str, dict[str, object]]:
    """Every fly-to target: the 14 story places, then the streets and districts."""
    out: dict[str, dict[str, object]] = {}
    for pid, p in PLACES.items():
        out[pid] = {"name": p["name"], "x": p["x"], "y": p["y"], "kind": "place",
                    "aliases": [*PLACE_ALIASES.get(pid, [])]}
    for sid, s in EXTRA_SPOTS.items():
        out[sid] = {"name": s["name"], "x": s["x"], "y": s["y"], "kind": "street", "aliases": list(s["aliases"])}  # type: ignore[arg-type]
    return out


def _keys(item_id: str, name: str, aliases: list[str]) -> list[str]:
    keys = [_core(name), _core(item_id), *(_core(a) for a in aliases)]
    return [k for k in dict.fromkeys(keys) if k]


def _score(heard: str, key: str) -> float:
    if heard == key:
        return 1.0
    hw, kw = heard.split(), key.split()
    # every word of the key said, in order, inside a longer phrase ("coquina row bit"), unless the
    # extra words name another street ("ocean drive" is not "the ocean")
    if kw and _within(hw, kw) and not (set(hw) - set(kw)) & _SUFFIXES:
        return 0.95
    return SequenceMatcher(None, heard, key).ratio()


def _within(hw: list[str], kw: list[str]) -> bool:
    n = len(kw)
    return any(hw[i : i + n] == kw for i in range(len(hw) - n + 1))


def _best(heard: str, table: dict[str, list[str]]) -> tuple[str, float]:
    h = _core(heard)
    if not h:
        return "", 0.0
    best, score = "", 0.0
    for item_id, keys in table.items():
        for k in keys:
            s = _score(h, k)
            if s > score + 1e-9:
                best, score = item_id, s
    return best, score


def _spot_table() -> dict[str, list[str]]:
    return {sid: _keys(sid, str(s["name"]), list(s["aliases"])) for sid, s in spots().items()}  # type: ignore[arg-type]


def _unit_table() -> dict[str, list[str]]:
    return {uid: _keys(uid, str(u["label"]), [str(u["tag"]), *UNIT_ALIASES.get(uid, [])]) for uid, u in UNITS.items() if uid != "sky_seven"}


def nearest_spot(x: float, y: float, skip: str = "") -> str:
    best, bd = "", float("inf")
    for sid, s in spots().items():
        if sid == skip:
            continue
        d = (float(s["x"]) - x) ** 2 + (float(s["y"]) - y) ** 2  # type: ignore[arg-type]
        if d < bd:
            best, bd = sid, d
    return best


def resolve_place(heard: str, near: tuple[float, float] | None = None) -> dict[str, object]:
    """A heard name -> {ok, id, name, x, y} or {ok: False, heard, suggest}."""
    table = spots()
    sid, score = _best(heard, _spot_table())
    if sid and score >= MATCH:
        s = table[sid]
        return {"ok": True, "id": sid, "name": s["name"], "x": s["x"], "y": s["y"]}
    if sid and score >= SUGGEST:
        suggest = sid
    elif near is not None:
        suggest = nearest_spot(near[0], near[1])
    else:
        suggest = "palm_causeway"
    return {"ok": False, "heard": str(heard)[:60], "error": "unknown place", "suggest": table[suggest]["name"], "suggest_id": suggest}


def resolve_unit(heard: str) -> dict[str, object]:
    uid, score = _best(heard, _unit_table())
    if uid and score >= MATCH:
        return {"ok": True, "id": uid, "name": UNITS[uid]["label"]}
    return {"ok": False, "heard": str(heard)[:60], "error": "unknown unit", "suggest": "The jet ski", "suggest_id": "jet_ski"}


def dispatch(name: str, args: object, near: tuple[float, float] | None = None) -> dict[str, object]:
    """What a tool call means, without running it. The browser twin runs the same steps, then moves."""
    a = args if isinstance(args, dict) else {}
    if name in ("fly_to", "circle"):
        r = resolve_place(str(a.get("place", "")), near)
        return {"tool": name, **r}
    if name == "follow":
        return {"tool": name, **resolve_unit(str(a.get("unit", "")))}
    if name == "spotlight":
        on = a.get("on", True)
        on = on if isinstance(on, bool) else str(on).strip().lower() not in ("false", "off", "0", "no")
        return {"tool": name, "ok": True, "on": on}
    if name == "report":
        return {"tool": name, "ok": True}
    return {"tool": name, "ok": False, "error": "unknown tool"}


# The pilot's own words, for the turns where he says he is going somewhere but no tool fired.
_MOVE = re.compile(
    r"\b(?:heading|headed|head|going|flying|fly|swinging|swing|moving|turning|banking|bringing (?:her|it|us)|on (?:my|our) way|taking (?:her|us|it))\b"
    r"(?:\s+(?:over|to|toward|towards|for|down to|up to|out to|across to|back to|over to|on to|onto|above))?\s+(?P<to>[a-z0-9' ]{3,40})"
)
_CIRCLE = re.compile(r"\b(?:circling|circle|orbiting|orbit|looping|loop)\s+(?:over|around|above)?\s*(?P<to>[a-z0-9' ]{3,40})")
_FOLLOW = re.compile(r"\b(?:following|follow|tailing|tail|tracking|track|staying on|on the tail of|chasing|after)\s+(?P<who>[a-z0-9' ]{3,40})")
_LIGHT_ON = re.compile(r"\b(?:spotlight|searchlight|light) (?:is )?on\b|\blights? (?:it|him|her|them) up\b|\bhitting (?:the|my) (?:spot|search)light\b")
_LIGHT_OFF = re.compile(r"\b(?:spotlight|searchlight|light) (?:is )?off\b|\bkilling the (?:spot|search)?light\b")


def _clip(fragment: str) -> str:
    # stop at the first clause break so "to coquina row now, hang on" -> "coquina row"
    return re.split(r"\b(?:now|then|and|but|so|because|right|hang|stand|over and out|copy|roger)\b|[,.;!?]", fragment)[0].strip()


def intent_from_speech(text: str) -> dict[str, object] | None:
    """The pilot said he is moving: the tool call it means, or None. Only confident matches move."""
    t = " ".join(re.sub(r"[^a-z0-9' ,.;!?]+", " ", str(text).lower()).split())
    m = _FOLLOW.search(t)
    if m:
        r = resolve_unit(_clip(m["who"]))
        if r["ok"]:
            return {"tool": "follow", "args": {"unit": r["id"]}}
    m = _CIRCLE.search(t)
    if m:
        r = resolve_place(_clip(m["to"]))
        if r["ok"]:
            return {"tool": "circle", "args": {"place": r["id"]}}
    for m in _MOVE.finditer(t):
        r = resolve_place(_clip(m["to"]))
        if r["ok"]:
            return {"tool": "fly_to", "args": {"place": r["id"]}}
    if _LIGHT_OFF.search(t):
        return {"tool": "spotlight", "args": {"on": False}}
    if _LIGHT_ON.search(t):
        return {"tool": "spotlight", "args": {"on": True}}
    return None


def public_table() -> dict[str, object]:
    """What the browser's matcher needs: normalised keys only, plus coordinates and names."""
    s = spots()
    return {
        "match": MATCH,
        "suggest": SUGGEST,
        "filler": sorted(_FILLER),
        "suffix": _SUFFIX,
        "spots": {sid: {"name": v["name"], "x": v["x"], "y": v["y"], "kind": v["kind"], "keys": keys} for sid, keys in _spot_table().items() for v in [s[sid]]},
        "units": {uid: {"name": UNITS[uid]["label"], "keys": keys} for uid, keys in _unit_table().items()},
    }


def names_for_prompt() -> str:
    s = spots()
    places = ", ".join(str(v["name"]) for v in s.values() if v["kind"] == "place")
    streets = ", ".join(str(v["name"]) for v in s.values() if v["kind"] == "street")
    return f"Places: {places}. Streets and areas: {streets}."
