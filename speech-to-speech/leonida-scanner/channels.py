"""Channel scripts, voices, and the fictional city. Data only, no network.

Everything here is original: the city of Port Ibis, its districts and streets,
every unit, and every code. "Code Pelican" and friends are invented on purpose
so nothing sounds like a real dispatch code.
"""

from __future__ import annotations

# A route is a list of map points (the jet ski's path through Heron Bay).
# Place ids are what the LLM may answer with. x/y are in the map's 1200x900 viewBox.
PLACES: dict[str, dict[str, object]] = {
    "heron_marina": {"name": "Heron Marina", "x": 775, "y": 573},
    "palm_causeway": {"name": "Palm Causeway", "x": 900, "y": 432},
    "sandbar_inlet": {"name": "Sandbar Inlet", "x": 1028, "y": 816},
    "flamingo_strip": {"name": "Flamingo Strip", "x": 1007, "y": 560},
    "lighthouse_point": {"name": "Lighthouse Point", "x": 978, "y": 48},
    "coral_court": {"name": "Coral Court", "x": 600, "y": 300},
    "banyan_park": {"name": "Banyan Park", "x": 679, "y": 418},
    "cypress_toll": {"name": "Cypress Toll", "x": 452, "y": 168},
    "orange_grove": {"name": "Orange Grove Interchange", "x": 476, "y": 620},
    "mango_heights": {"name": "Mango Heights", "x": 365, "y": 380},
    "old_quay": {"name": "Old Quay", "x": 712, "y": 118},
    "gator_flats": {"name": "Gator Flats", "x": 150, "y": 390},
    "ibis_field": {"name": "Ibis Field", "x": 255, "y": 740},
    "coquina_row": {"name": "Coquina Row", "x": 650, "y": 756},
}

# The player blip. Callers are "near Banyan Park" unless they say otherwise.
PLAYER = {"place": "banyan_park", "label": "You"}

# speaker id -> label, Lightning v3.1 Pro voice, home place, and whether it moves on the map
CHANNELS: list[dict[str, object]] = [
    {
        "id": "metro",
        "num": 1,
        "name": "Metro dispatch",
        "tagline": "City units, bored and professional",
        "persona": (
            "Port Ibis city police dispatch, a parody. Dry, bored, professional. "
            "Codes are invented: Code Pelican means a suspect on the water, "
            "Code Mango means a stalled vehicle, Status Tangerine means all clear."
        ),
        "intruder": 'Unknown station, this is a restricted police channel. Identify yourself. Are you an authorised unit?',
        "route": [
            [812, 550],
            [822, 544],
            [862, 612],
            [912, 700],
            [962, 778],
            [1026, 816],
            [1090, 826],
        ],
        "speakers": {
            "dispatch": {
                "label": "Dispatch",
                "tag": "Dispatch",
                "voice": "kaitlyn",
                "home": "coral_court",
                "mobile": False,
            },
            "reyes": {
                "label": "Unit 23 Reyes",
                "tag": "23",
                "voice": "blake",
                "home": "palm_causeway",
                "mobile": True,
            },
            "peck": {
                "label": "Unit 14 Peck",
                "tag": "14",
                "voice": "austin",
                "home": "cypress_toll",
                "mobile": True,
            },
            "holt": {
                "label": "Sergeant Holt",
                "tag": "Holt",
                "voice": "zoe",
                "home": "coquina_row",
                "mobile": True,
            },
        },
        "lines": [
            {
                "speaker": "dispatch",
                "place": "heron_marina",
                "gap": 1.6,
                "text": "All units, Code Pelican at Heron Marina. Man in a pink flamingo shirt just took a jet ski, heading south down the bay.",
            },
            {
                "speaker": "reyes",
                "place": "palm_causeway",
                "gap": 2.4,
                "text": "Twenty-three copies. I'm up on the Palm Causeway, I can see his wake from here.",
            },
            {
                "speaker": "peck",
                "place": "cypress_toll",
                "gap": 1.8,
                "text": "Fourteen, still at Cypress Toll. The Code Mango is now a coupe with no gas and no driver.",
            },
            {
                "speaker": "dispatch",
                "place": "cypress_toll",
                "gap": 2.2,
                "text": "Fourteen, leave the coupe. Twenty-three, is he still on the water?",
            },
            {
                "speaker": "reyes",
                "place": "sandbar_inlet",
                "at": "sandbar_inlet",
                "gap": 1.6,
                "text": "Affirmative. He's waving at boats near Sandbar Inlet. He looks very happy about all of this.",
            },
            {
                "speaker": "holt",
                "place": "sandbar_inlet",
                "gap": 3.0,
                "text": "Holt here. Nobody follows him into open water. Harbor patrol has the inlet, we hold the shore.",
            },
            {
                "speaker": "dispatch",
                "place": "flamingo_strip",
                "gap": 1.8,
                "text": "Copy, sergeant. All units, there's also a loose peacock on the Flamingo Strip. Not a priority.",
            },
            {
                "speaker": "peck",
                "place": "flamingo_strip",
                "at": "flamingo_strip",
                "gap": 4.0,
                "text": "Fourteen. I'll take the peacock. Somebody has to.",
            },
        ],
        "fallback": [
            {
                "speaker": 'dispatch',
                "place": 'banyan_park',
                "text": 'Unknown station, this is a restricted police channel. Identify yourself, are you even authorised?',
            },
            {
                "speaker": 'reyes',
                "place": 'banyan_park',
                "text": "Twenty-three. Somebody's on our frequency again. I'll swing by Banyan Park and take a look.",
            },
        ],
    },
    {
        "id": "harbor",
        "num": 2,
        "name": "Harbor patrol",
        "tagline": "Boats, towers and the tide",
        "persona": (
            "The Port Ibis harbor patrol and lifeguard towers. Calm, nautical, a little smug about the tide."
        ),
        "intruder": 'Unidentified station on harbor channel, this frequency is for patrol traffic only. State your name and your vessel.',
        "route": [
            [812, 550],
            [822, 544],
            [862, 612],
            [912, 700],
            [962, 778],
            [1026, 816],
            [1090, 826],
        ],
        "speakers": {
            "base": {
                "label": "Harbor base",
                "tag": "Base",
                "voice": "chelsea",
                "home": "heron_marina",
                "mobile": False,
            },
            "marine2": {
                "label": "Marine Two",
                "tag": "Marine 2",
                "voice": "hunter",
                "home": "sandbar_inlet",
                "mobile": True,
            },
            "tower4": {
                "label": "Tower Four",
                "tag": "Tower 4",
                "voice": "dean",
                "home": "flamingo_strip",
                "mobile": False,
            },
        },
        "lines": [
            {
                "speaker": "base",
                "place": "heron_marina",
                "gap": 2.0,
                "text": "Harbor base to Marine Two. Stolen jet ski left slip forty. Flamingo shirt, no life vest.",
            },
            {
                "speaker": "marine2",
                "place": "sandbar_inlet",
                "gap": 2.6,
                "text": "Marine Two, idling at the inlet. Tide's going out. He'll come to me.",
            },
            {
                "speaker": "tower4",
                "place": "palm_causeway",
                "gap": 1.8,
                "text": "Tower Four. I can see him from the chair. He just did a full lap around a pelican.",
            },
            {
                "speaker": "base",
                "place": "flamingo_strip",
                "gap": 2.4,
                "text": "Tower Four, keep swimmers out of the north end, and put the yellow flag up. It's getting choppy.",
            },
            {
                "speaker": "marine2",
                "place": "sandbar_inlet",
                "gap": 2.0,
                "text": "He's out of fuel. He is paddling. With his hands. Moving in now, nice and slow.",
            },
            {
                "speaker": "tower4",
                "place": "lighthouse_point",
                "gap": 4.2,
                "text": "Tower Four, unrelated. A man on the jetty at Lighthouse Point is fishing with a hot dog. Logging it.",
            },
        ],
        "fallback": [
            {
                "speaker": 'base',
                "place": 'heron_marina',
                "text": 'Unidentified station, this is harbor patrol traffic only. State your name and your vessel.',
            },
            {
                "speaker": 'marine2',
                "place": 'heron_marina',
                "text": 'Marine Two. We have a stranger on the band. Turning around to have a look.',
            },
        ],
    },
    {
        "id": "sky7",
        "num": 3,
        "name": "Sky 7 news",
        "tagline": "A news chopper and an impatient studio",
        "persona": (
            "A local TV news helicopter, Sky Seven, and its producer back at the studio. "
            "The pilot is laconic, the producer wants a better story than traffic."
        ),
        "intruder": 'Who is on the studio line? This is a closed production channel, are you even in the building?',
        "route": [
            [812, 550],
            [822, 544],
            [862, 612],
            [912, 700],
            [962, 778],
            [1026, 816],
            [1090, 826],
        ],
        "speakers": {
            "studio": {
                "label": "Studio",
                "tag": "Studio",
                "voice": "kennedy",
                "home": "coral_court",
                "mobile": False,
            },
            "pilot": {
                "label": "Sky Seven",
                "tag": "Sky 7",
                "voice": "brooks",
                "home": "orange_grove",
                "mobile": True,
            },
        },
        "lines": [
            {
                "speaker": "studio",
                "place": "coral_court",
                "gap": 1.6,
                "text": "Sky Seven, studio. We're live in ninety seconds. Give me something better than traffic.",
            },
            {
                "speaker": "pilot",
                "place": "orange_grove",
                "gap": 1.4,
                "text": "Sky Seven. Orange Grove Interchange is a parking lot, and a guy is selling mangoes between the lanes.",
            },
            {
                "speaker": "studio",
                "place": "orange_grove",
                "gap": 2.6,
                "text": "Is that a story? Is the mango guy a story?",
            },
            {
                "speaker": "pilot",
                "place": "palm_causeway",
                "at": "palm_causeway",
                "gap": 1.6,
                "text": "Swinging east. I've got a jet ski under the Palm Causeway and a man in a very loud shirt.",
            },
            {
                "speaker": "studio",
                "place": "palm_causeway",
                "gap": 2.2,
                "text": "That's the lead. Stay on him. And do not say flamingo on air more than once.",
            },
            {
                "speaker": "pilot",
                "place": "ibis_field",
                "at": "ibis_field",
                "gap": 4.4,
                "text": "Copy. Fuel's at a third. I need to be back at Ibis Field by the top of the hour.",
            },
        ],
        "fallback": [
            {
                "speaker": 'studio',
                "place": 'coral_court',
                "text": 'Who is on my studio line? This is a closed production channel. Are you even in the building?',
            },
            {
                "speaker": 'pilot',
                "place": 'banyan_park',
                "text": 'Sky Seven. Whoever that is, you sound like a story. Banking that way.',
            },
        ],
    },
    {
        "id": "cabs",
        "num": 4,
        "name": "Sunrise cabs",
        "tagline": "A cab base that has seen it all",
        "persona": (
            "Sunrise Cabs dispatch in Port Ibis. The base dispatcher is warm and tired, "
            "the drivers gossip about fares and traffic."
        ),
        "intruder": 'Whoever that is, you are not one of my drivers. Get off my dispatch radio, or tell me where you need a cab.',
        "route": [],
        "speakers": {
            "base": {
                "label": "Sunrise base",
                "tag": "Base",
                "voice": "kimberly",
                "home": "coquina_row",
                "mobile": False,
            },
            "cab41": {
                "label": "Cab 41",
                "tag": "41",
                "voice": "tucker",
                "home": "mango_heights",
                "mobile": True,
            },
            "cab9": {
                "label": "Cab 9",
                "tag": "9",
                "voice": "piper",
                "home": "coral_court",
                "mobile": True,
            },
        },
        "lines": [
            {
                "speaker": "base",
                "place": "coral_court",
                "gap": 1.8,
                "text": "Sunrise base. Who's near Coral Court? Fare to Ibis Field, says he's late for a wedding.",
            },
            {
                "speaker": "cab41",
                "place": "mango_heights",
                "gap": 1.6,
                "text": "Forty-one, I'm in Mango Heights. Ten minutes, if the interchange lets me live.",
            },
            {
                "speaker": "cab9",
                "place": "coral_court",
                "gap": 2.0,
                "text": "Cab Nine, I'm right outside Coral Court. I'll take the wedding guy.",
            },
            {
                "speaker": "base",
                "place": "coral_court",
                "gap": 2.4,
                "text": "Nine, he's yours. He asked if you have an aux cord. Say no.",
            },
            {
                "speaker": "cab41",
                "place": "orange_grove",
                "at": "orange_grove",
                "gap": 2.2,
                "text": "Forty-one. Interchange is stopped. There's a news chopper and everybody's looking up.",
            },
            {
                "speaker": "cab9",
                "place": "ibis_field",
                "at": "ibis_field",
                "gap": 4.0,
                "text": "Nine, dropped him at Ibis Field. He tipped me in airline peanuts. Heading back to the stand.",
            },
        ],
        "fallback": [
            {
                "speaker": 'base',
                "place": 'banyan_park',
                "text": 'Whoever that is, you are not one of my drivers. Get off my radio, or tell me where you need a cab.',
            },
            {
                "speaker": 'cab9',
                "place": 'banyan_park',
                "text": "Cab Nine. Stranger on the base channel. I'm close to Banyan Park, I'll find them.",
            },
        ],
    },
    {
        "id": "cb19",
        "num": 5,
        "name": "Citizens band 19",
        "tagline": "Truckers, a swamp local and a man with theories",
        "persona": (
            "An open citizens band channel. Chaotic and friendly: a long-haul trucker, "
            "a swamp local who knows every gator, and an overnight caller with theories."
        ),
        "intruder": "Breaker, we got a new voice on nineteen. Who is this, and what's your handle, stranger?",
        "route": [],
        "speakers": {
            "wes": {
                "label": "Big Wes",
                "tag": "Big Wes",
                "voice": "wesley",
                "home": "cypress_toll",
                "mobile": True,
            },
            "mango": {
                "label": "Mango Mama",
                "tag": "Mango",
                "voice": "molly",
                "home": "gator_flats",
                "mobile": False,
            },
            "owl": {
                "label": "Night Owl",
                "tag": "Owl",
                "voice": "winston",
                "home": "lighthouse_point",
                "mobile": False,
            },
        },
        "lines": [
            {
                "speaker": "wes",
                "place": "cypress_toll",
                "gap": 1.6,
                "text": "Breaker one-nine, Big Wes northbound at Cypress Toll. Anybody got eyes on the swamp road?",
            },
            {
                "speaker": "mango",
                "place": "gator_flats",
                "gap": 1.8,
                "text": "Mango Mama, out at Gator Flats. Road's open, but there's a gator sunbathing on the center line.",
            },
            {
                "speaker": "owl",
                "place": "palm_causeway",
                "gap": 2.4,
                "text": "Night Owl, Lighthouse Point. Gentlemen, I believe the lights over the bay are not aircraft.",
            },
            {
                "speaker": "wes",
                "place": "palm_causeway",
                "gap": 2.0,
                "text": "Owl, that's the news chopper. It's always the news chopper.",
            },
            {
                "speaker": "mango",
                "place": "gator_flats",
                "gap": 2.2,
                "text": "Gator just moved. He went left. Big Wes, you go right. Trust me.",
            },
            {
                "speaker": "owl",
                "place": "sandbar_inlet",
                "gap": 4.4,
                "text": "Night Owl again. A man on a jet ski just waved at me. I waved back. We are friends now.",
            },
        ],
        "fallback": [
            {
                "speaker": 'wes',
                "place": 'banyan_park',
                "text": "Breaker breaker, new voice on nineteen. Who is this, and what's your handle, stranger?",
            },
            {
                "speaker": 'owl',
                "place": 'lighthouse_point',
                "text": "Night Owl. I don't know who you are, but I believe you. I believe everybody, that's my problem.",
            },
        ],
    },
]

# ---------------------------------------------------------------- v3: units and the live channel
# Everything on the map and in the 3D view that can move. One id per thing, shared by the
# scripted channels, the push-to-talk replies and the live channel's move_unit tool.
# kind decides which road graph a unit may use: car and person use roads, boat and jetski use water,
# heli flies in a straight line. model is a file in web/static/models (see ASSETS.md).
UNITS: dict[str, dict[str, object]] = {
    "unit_23": {"tag": "23", "label": "Unit 23 Reyes", "kind": "car", "model": "police", "home": "palm_causeway"},
    "unit_14": {"tag": "14", "label": "Unit 14 Peck", "kind": "car", "model": "sedan", "home": "cypress_toll"},
    "sgt_holt": {"tag": "Holt", "label": "Sergeant Holt", "kind": "car", "model": "suv", "home": "coquina_row"},
    "marine_two": {"tag": "M2", "label": "Marine Two", "kind": "boat", "model": "boat_speed_a", "home": "sandbar_inlet"},
    "jet_ski": {"tag": "Jet ski", "label": "The jet ski", "kind": "jetski", "model": "boat_speed_c", "home": "heron_marina"},
    "sky_seven": {"tag": "Sky 7", "label": "Sky Seven", "kind": "heli", "model": "", "home": "orange_grove"},
    "cab_41": {"tag": "41", "label": "Cab 41", "kind": "car", "model": "taxi", "home": "mango_heights"},
    "cab_9": {"tag": "9", "label": "Cab 9", "kind": "car", "model": "hatchback_sports", "home": "coral_court"},
    "big_wes": {"tag": "Wes", "label": "Big Wes", "kind": "car", "model": "truck", "home": "cypress_toll"},
    "wedding_guest": {"tag": "Guest", "label": "The wedding guest", "kind": "person", "model": "character_a", "home": "coral_court"},
    "mango_seller": {"tag": "Mango", "label": "The mango seller", "kind": "person", "model": "character_d", "home": "orange_grove"},
}

# A scripted speaker is also a unit, so a line that says "I'm at the inlet" moves it.
SPEAKER_UNIT: dict[tuple[str, str], str] = {
    ("metro", "reyes"): "unit_23",
    ("metro", "peck"): "unit_14",
    ("metro", "holt"): "sgt_holt",
    ("harbor", "marine2"): "marine_two",
    ("sky7", "pilot"): "sky_seven",
    ("cabs", "cab41"): "cab_41",
    ("cabs", "cab9"): "cab_9",
    ("cb19", "wes"): "big_wes",
}

# Where the runaway jet ski is, line by line. (channel id, line index) -> place id.
JET_SKI_BEATS: dict[tuple[str, int], str] = {
    ("metro", 0): "heron_marina",
    ("metro", 1): "palm_causeway",
    ("metro", 4): "sandbar_inlet",
    ("harbor", 0): "heron_marina",
    ("harbor", 2): "palm_causeway",
    ("harbor", 4): "sandbar_inlet",
    ("sky7", 3): "palm_causeway",
    ("cb19", 5): "sandbar_inlet",
}

# Two walkers who get moved by the story: the wedding guest and the mango seller.
PERSON_BEATS: dict[tuple[str, int], tuple[str, str, str]] = {
    ("cabs", 0): ("wedding_guest", "coral_court", "drive_to"),
    ("cabs", 5): ("wedding_guest", "ibis_field", "chase"),
    ("sky7", 1): ("mango_seller", "orange_grove", "drive_to"),
    ("sky7", 4): ("mango_seller", "mango_heights", "drive_to"),
}

ACTIONS = ("drive_to", "chase", "stop", "circle", "highlight")

# Channel 6 is not a loop of clips. It is one live Hydra voice, so it has no lines.
LIVE_CHANNEL: dict[str, object] = {
    "id": "live",
    "num": 6,
    "name": "Sky 7 live",
    "tagline": "A news chopper pilot, live. Talk over him any time.",
    "persona": "Sky Seven, the Port Ibis news chopper pilot, live on air.",
    "route": [],
    "voice": "leo",
    "speakers": {
        "sky_seven": {
            "label": "Sky Seven",
            "tag": "Sky 7",
            "voice": "leo",
            "home": "orange_grove",
            "mobile": True,
        }
    },
    "lines": [],
}

CHANNEL_BY_ID = {str(ch["id"]): ch for ch in CHANNELS}



# ---------------------------------------------------------------- what the 3D view shows
# Every aired line (scripted, push-to-talk reply) carries one scene: which unit the camera
# follows, where it is going, and how. The 2D map, the 3D chase view and the caption all read it,
# so what you see is what the radio just said.
import re as _re  # noqa: E402

UNIT_MENTIONS: list[tuple[str, str]] = [
    ("jet_ski", r"jet ?ski|his wake|flamingo shirt|loud shirt|waving at boats|on the water|paddling"),
    ("sky_seven", r"chopper|helicopter|sky seven|lights over the bay|not aircraft"),
    ("marine_two", r"marine two"),
    ("unit_23", r"\btwenty-three\b|\bunit 23\b"),
    ("unit_14", r"\bfourteen\b|\bunit 14\b"),
    ("sgt_holt", r"\bholt\b|\bsergeant\b"),
    ("cab_41", r"\bforty-one\b|\bcab 41\b"),
    ("cab_9", r"\bcab nine\b|(?<![-\w])nine\b(?!-)|\bcab 9\b"),
    ("big_wes", r"\bbig wes\b|\bwes\b"),
    ("wedding_guest", r"\bwedding\b"),
    ("mango_seller", r"\bmango (?:guy|seller|man)\b|selling mangoes"),
]
_CHASE = _re.compile(r"\b(chas\w*|pursu\w*|after (?:him|her|them)|flee\w*|took (?:a|off)|step on it|hurry|running)\b")
_CIRCLE = _re.compile(r"\b(circl\w*|lap around|overhead|orbit\w*|swinging)\b")
_STOP = _re.compile(r"\b(hold\w*|idling|stopped|parked|stuck|sunbathing|out of fuel|leave the|waiting|still at)\b")


def infer_action(text: str, default: str = "drive_to") -> str:
    t = text.lower()
    if _CHASE.search(t):
        return "chase"
    if _CIRCLE.search(t):
        return "circle"
    if _STOP.search(t):
        return "stop"
    return default


def mentioned_unit(text: str) -> str | None:
    """The unit the line talks about first, by position in the text."""
    t = text.lower()
    best: tuple[int, str] | None = None
    for uid, pat in UNIT_MENTIONS:
        m = _re.search(pat, t)
        if m and (best is None or m.start() < best[0]):
            best = (m.start(), uid)
    return best[1] if best else None


def mentions(text: str) -> set[str]:
    t = text.lower()
    return {uid for uid, pat in UNIT_MENTIONS if _re.search(pat, t)}


def channel_units(channel_id: str) -> list[str]:
    """Units a dispatcher on this channel can send: its own mobile speakers."""
    return [u for (c, _s), u in SPEAKER_UNIT.items() if c == channel_id]


def _nearest(units: list[str], place: str) -> str | None:
    p = PLACES.get(place)
    if not p or not units:
        return None

    def dist(uid: str) -> float:
        h = PLACES[str(UNITS[uid]["home"])]
        return (h["x"] - p["x"]) ** 2 + (h["y"] - p["y"]) ** 2

    return min(units, key=dist)


def scene_for(
    channel_id: str,
    speaker: str,
    text: str,
    place: str,
    at: str | None = None,
    beat: tuple[str, str, str] | None = None,
    unit_hint: str | None = None,
    action_hint: str | None = None,
) -> dict[str, object]:
    """One line -> {unit, place, action, cue}. Pure; the tests pin the mapping."""
    if place not in PLACES:
        place = "banyan_park"
    own = SPEAKER_UNIT.get((channel_id, speaker))
    bg: dict[str, str] | None = None
    if beat:
        unit, where, action = beat
        focus = UNITS.get(unit, {}).get("kind") != "person" or unit in mentions(text)
        if focus:
            return {"unit": unit, "place": where, "action": infer_action(text, action), "cue": True}
        # A walker moving in the background: it still moves, but the camera stays on the story.
        bg = {"unit": unit, "place": where, "action": action}
        out = scene_for(channel_id, speaker, text, place, at, None, unit_hint, action_hint)
        out["bg"] = bg
        return out
    if unit_hint in UNITS:
        act = action_hint if action_hint in ACTIONS and action_hint != "highlight" else infer_action(text)
        return {"unit": unit_hint, "place": place, "action": act, "cue": False}
    if own and at:
        return {"unit": own, "place": at, "action": infer_action(text), "cue": True}
    named = mentioned_unit(text)
    if named:
        return {"unit": named, "place": place, "action": infer_action(text), "cue": False}
    if own:
        return {"unit": own, "place": place, "action": infer_action(text), "cue": False}
    near = _nearest(channel_units(channel_id), place)
    if near:
        return {"unit": near, "place": place, "action": infer_action(text), "cue": False}
    return {"unit": "sky_seven", "place": place, "action": "circle", "cue": False}


def line_scene(channel_id: str, index: int) -> dict[str, object]:
    ch = CHANNEL_BY_ID[channel_id]
    ln = ch["lines"][index]  # type: ignore[index]
    beat: tuple[str, str, str] | None = None
    jet = JET_SKI_BEATS.get((channel_id, index))
    person = PERSON_BEATS.get((channel_id, index))
    if jet:
        beat = ("jet_ski", jet, "chase")
    elif person:
        beat = person
    return scene_for(channel_id, ln["speaker"], ln["text"], ln["place"], ln.get("at"), beat)


def all_voices() -> set[str]:
    return {
        str(sp["voice"])  # type: ignore[index]
        for ch in CHANNELS
        for sp in ch["speakers"].values()  # type: ignore[union-attr]
    }


def public_payload() -> dict[str, object]:
    """What the browser needs. No voice ids are secret, but nothing else leaves."""
    channels = []
    for ch in CHANNELS:
        channels.append(
            {
                "id": ch["id"],
                "num": ch["num"],
                "name": ch["name"],
                "tagline": ch["tagline"],
                "route": ch["route"],
                "speakers": {
                    sid: {
                        "label": sp["label"],
                        "tag": sp["tag"],
                        "home": sp["home"],
                        "mobile": sp["mobile"],
                    }
                    for sid, sp in ch["speakers"].items()  # type: ignore[union-attr]
                },
                "lines": [
                    {
                        "i": i,
                        "speaker": ln["speaker"],
                        "text": ln["text"],
                        "place": ln["place"],
                        "at": ln.get("at"),
                        "gap": ln["gap"],
                        "scene": line_scene(str(ch["id"]), i),
                    }
                    for i, ln in enumerate(ch["lines"])  # type: ignore[arg-type]
                ],
            }
        )
    live = LIVE_CHANNEL
    channels.append(
        {
            "id": live["id"],
            "num": live["num"],
            "name": live["name"],
            "tagline": live["tagline"],
            "route": [],
            "live": True,
            "speakers": {
                sid: {
                    "label": sp["label"],
                    "tag": sp["tag"],
                    "home": sp["home"],
                    "mobile": sp["mobile"],
                }
                for sid, sp in live["speakers"].items()  # type: ignore[union-attr]
            },
            "lines": [],
        }
    )
    units = {
        uid: {k: u[k] for k in ("tag", "label", "kind", "model", "home")}
        for uid, u in UNITS.items()
    }
    beats = {
        "speakers": {f"{c}:{s}": u for (c, s), u in SPEAKER_UNIT.items()},
        "jet": {f"{c}:{i}": p for (c, i), p in JET_SKI_BEATS.items()},
        "person": {
            f"{c}:{i}": {"unit": u, "place": p, "action": a}
            for (c, i), (u, p, a) in PERSON_BEATS.items()
        },
    }
    from sky import public_table  # sky imports this module, so late

    return {
        "channels": channels,
        "places": PLACES,
        "player": PLAYER,
        "units": units,
        "beats": beats,
        "sky": public_table(),
    }
