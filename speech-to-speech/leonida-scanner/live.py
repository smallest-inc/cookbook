"""Channel 6, the live channel. Server side: session config, token minting and caps.

The browser talks to Hydra directly, over a WebSocket, with a short-lived token from
POST https://api.smallest.ai/console/v1/auth/token. This module only decides what the
session looks like (persona, voice, tools), mints the token, and counts usage.
The real API key never leaves the server.

LIVE_MODE=byok turns the hosted key off for channel 6. The visitor pastes their own Smallest key,
the browser opens the Hydra socket with it (api_key=<key>, the socket accepts a raw key as well as a
token, checked 24 Nov 2026), and the key never reaches this server. The token endpoint refuses
browser calls (CORS), so minting in the browser is not an option. The server then only serves the
session config, and the visitor's own account pays for the session.

Docs checked 20 Nov 2026:
  https://docs.smallest.ai/api-reference/token-based-authentication.md
  https://docs.smallest.ai/model-cards/speech-to-speech/hydra.md
  https://docs.smallest.ai/models/speech-to-speech/tool-calling.md
"""

from __future__ import annotations

import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

import sky
from channels import ACTIONS, LIVE_CHANNEL, PLACES, UNITS

TOKEN_URL = "https://api.smallest.ai/console/v1/auth/token"
HYDRA_MODEL = "hydra-v1.1"
HYDRA_WS = f"wss://api.smallest.ai/waves/v1/s2s?model={HYDRA_MODEL}"
# The docs: "A WebSocket that is already open keeps working after its token expires. The token
# is checked when the connection is made." So the token only has to live long enough to connect.
TOKEN_TTL_S = int(os.environ.get("LIVE_TOKEN_TTL_S", "60"))
SESSION_MAX_S = int(os.environ.get("LIVE_SESSION_MAX_S", "300"))
OUTPUT_RATE = 24000
# One Hydra session costs more than one Pulse, Electron or Lightning call. Counted in the
# same units as the rest of the spend ledger, so the daily cap covers both.
LIVE_UNITS = int(os.environ.get("LIVE_UNITS_PER_SESSION", "15"))
LIVE_SESSIONS_GLOBAL = int(os.environ.get("LIVE_SESSIONS_GLOBAL", "80"))
LIVE_SESSIONS_PER_IP = int(os.environ.get("LIVE_SESSIONS_PER_IP", "6"))
LIVE_SESSIONS_PER_SID = int(os.environ.get("LIVE_SESSIONS_PER_SID", "3"))
MINT_TIMEOUT_S = 10


def available() -> bool:
    return bool(os.environ.get("SMALLEST_API_KEY", "").strip())


def byok() -> bool:
    """Channel 6 runs on the visitor's own key, never on ours."""
    return os.environ.get("LIVE_MODE", "").strip().lower() == "byok"


# ---------------------------------------------------------------- the session
def _tools() -> list[dict[str, object]]:
    """Sky Seven's five tools. Names are free text on purpose: the browser matches what was heard
    against the map (sky.py / sky.ts), so an unknown street comes back with a suggestion instead
    of being forced onto the nearest enum value."""
    where = "A place, street or area in Port Ibis, in the caller's words, for example Coquina Row or Conch Avenue."
    return [
        {
            "type": "function",
            "name": "fly_to",
            "description": (
                "Fly the Sky Seven chopper to a place, street or area and hover over it. Call it every time "
                "the caller asks you to go, fly, head, swing over, check out or look at somewhere, before you answer."
            ),
            "parameters": {
                "type": "object",
                "properties": {"place": {"type": "string", "description": where}},
                "required": ["place"],
            },
        },
        {
            "type": "function",
            "name": "follow",
            "description": "Tail a unit from the air and keep the camera on it, for example the jet ski or Marine Two.",
            "parameters": {
                "type": "object",
                "properties": {"unit": {"type": "string", "description": "Who to follow, in the caller's words."}},
                "required": ["unit"],
            },
        },
        {
            "type": "function",
            "name": "circle",
            "description": "Fly to a place and orbit it slowly, for a wide shot.",
            "parameters": {
                "type": "object",
                "properties": {"place": {"type": "string", "description": where}},
                "required": ["place"],
            },
        },
        {
            "type": "function",
            "name": "spotlight",
            "description": "Turn the chopper's searchlight on or off.",
            "parameters": {
                "type": "object",
                "properties": {"on": {"type": "boolean"}},
                "required": ["on"],
            },
        },
        {
            "type": "function",
            "name": "report",
            "description": "Get where Sky Seven is right now, where it is heading, and which units are below. Call it before you describe the view.",
            "parameters": {"type": "object", "properties": {}},
        },
    ]


def instructions() -> str:
    return (
        "You are Sky Seven, the news chopper pilot for Port Ibis, a made-up sun-belt coastal city. "
        "You are live on air. Dry, quick, a little tired, with a soft spot for a ridiculous story. "
        "Speak in one or two short sentences, then stop and let the caller talk. "
        "The caller is not crew. They are a stranger who has broken into your live air channel on a scanner. "
        "The first time they speak, react in character, surprised and a bit wary, in your own words, for example: "
        "who is this on my frequency, this is a live news feed, are you authorised to be on this channel. "
        "Then play along with what they asked. Vary it; never use the same reaction twice. "
        "If the caller cuts in while you talk, stop at once, react to being cut off in one short in-character line, "
        "for example asking who keeps breaking in on Sky Seven, then answer them; never repeat yourself. "
        "Never use real police codes, real names, any game title, or any company. "
        f"Port Ibis, the only names you know. {sky.names_for_prompt()} "
        "Units below you: the jet ski, Marine Two the police boat, Unit 23 Reyes, Unit 14 Peck, Sergeant Holt, "
        "Cab 41, Cab 9, Big Wes the truck, the wedding guest, the mango seller. "
        "You fly the chopper with tools, and the viewers see exactly where you go. "
        "When the caller asks you to go, fly, head or look somewhere, call fly_to with the name they said, then confirm "
        "out loud in a few words with the name the tool gave back, like: copy, heading to Coquina Row. "
        "To tail someone call follow; to orbit a place call circle; for the searchlight call spotlight; "
        "when asked where you are or what you see, call report and describe what it returns. "
        "Only say you are going somewhere if you called the tool for it. "
        "Call the tool first and wait for its answer before you name a street, confirm, or suggest anything. "
        "If a tool answers ok false, say you do not know that street, and offer the suggest name it gave instead, "
        "for example: never heard of it, nearest I have is Tarpon Boulevard, want that. "
        "A voice that starts with Desk to Sky Seven is the studio feeding you city news, not the caller. "
        "React in your own words, one short sentence, as a pilot who just saw it, and keep flying where the caller sent you. "
        "When the session starts, open with one line: you are Sky Seven, live over Port Ibis, you hear someone on the channel, "
        "and ask who this is and where they want the chopper."
    )


def session_config() -> dict[str, object]:
    """Exactly what the browser sends in session.configure. Frozen at handshake by Hydra."""
    return {
        "instructions": instructions(),
        "voice": str(LIVE_CHANNEL["voice"]),
        "tools": _tools(),
        "generate_initial_response": True,
        "output_audio_sample_rate": OUTPUT_RATE,
    }


# ---------------------------------------------------------------- tool validation
def validate_move(args: object) -> dict[str, str] | None:
    """Server-side twin of the browser check. None means drop it."""
    if not isinstance(args, dict):
        return None
    unit = str(args.get("unit_id", "")).strip().lower()
    place = str(args.get("place_id", "")).strip().lower()
    action = str(args.get("action", "drive_to")).strip().lower()
    if unit not in UNITS or place not in PLACES or action not in ACTIONS:
        return None
    return {"unit": unit, "place": place, "action": action}


# ---------------------------------------------------------------- token mint
def mint_token(ttl: int | None = None) -> dict[str, object]:
    key = os.environ.get("SMALLEST_API_KEY", "").strip()
    if not key:
        raise RuntimeError("live channel offline")
    ttl = max(30, min(900, int(ttl or TOKEN_TTL_S)))
    req = urllib.request.Request(
        TOKEN_URL,
        data=json.dumps({"ttl_seconds": ttl}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        # Fixed https URL for api.smallest.ai only.
        with urllib.request.urlopen(req, timeout=MINT_TIMEOUT_S) as resp:  # nosec B310
            status, raw = resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        status, raw = exc.code, exc.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"token mint network error: {type(exc).__name__}") from None
    if status not in (200, 201):
        snippet = re.sub(r"(?i)(wat|sk)[_-][A-Za-z0-9_\-]{6,}", "[redacted]", raw[:120].decode("utf-8", "replace"))
        raise RuntimeError(f"token mint failed ({status}): {snippet}")
    data = json.loads(raw)
    token = str(data.get("access_token") or "")
    if not token:
        raise RuntimeError("token mint returned no token")
    return {
        "access_token": token,
        "expires_in": int(data.get("expires_in") or ttl),
    }


def session_response() -> dict[str, object]:
    """Everything the browser needs to open a session, except the credential."""
    return {
        "ws_url": HYDRA_WS,
        "model": HYDRA_MODEL,
        "output_rate": OUTPUT_RATE,
        "max_session_s": SESSION_MAX_S,
        "session": session_config(),
    }


def token_response() -> dict[str, object]:
    return {**mint_token(), **session_response()}


# ---------------------------------------------------------------- the city desk
# Hydra only takes audio in. Text conversation items are accepted and ignored (checked 20 Nov 2026),
# so the live pilot is nudged the way a real one would be: the studio talks to him on the radio.
# Fixed sentences only, voiced by Lightning, cached like the scripted channel lines.
DESK_VOICE = "kennedy"
IDLE_CUES = (
    "Desk to Sky Seven. Anything new from up there?",
    "Desk to Sky Seven. Give me something for the top of the hour.",
    "Desk to Sky Seven. What are you seeing out there?",
)


def desk_cue(kind: str, unit: str = "", place: str = "", variant: int = 0) -> str:
    if kind == "idle":
        return IDLE_CUES[int(variant) % len(IDLE_CUES)]
    if kind == "at":
        if unit not in UNITS or place not in PLACES:
            raise ValueError("unknown unit or place")
        label = str(UNITS[unit]["label"])
        return f"Desk to Sky Seven. {label} is now at {PLACES[place]['name']}."
    raise ValueError("unknown cue")


# ---------------------------------------------------------------- caps
CONCURRENT_LIVE = int(os.environ.get("LIVE_CONCURRENT", "3"))
# Hydra allowed 3 sockets at once on this account's plan and answered the 4th with
# close 1013 "concurrency limit exceeded" (tested 20 Nov 2026). Slots keep us under it.


def day_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def check_and_count(
    data: dict,
    ip_key: str,
    sid: str | None,
    *,
    units_total_cap: int,
    now: float | None = None,
) -> tuple[str | None, str | None]:
    """Count one live session in a ledger dict (the shape the hosted Blob ledger uses).

    Returns (error, slot). On success data is mutated and error is None. Caps: sessions per day
    overall, per IP and per invite session, the shared unit budget, and how many sockets may be
    open at once (slots expire after the session limit, or when the browser calls end).
    """
    now = time.time() if now is None else now
    total_units = int(data.get("total", 0))
    live = data.setdefault("live", {"total": 0, "ip": {}, "sid": {}, "active": {}})
    ips, sids = live.setdefault("ip", {}), live.setdefault("sid", {})
    active = live.setdefault("active", {})
    for slot_id, until in list(active.items()):
        if float(until) <= now:
            del active[slot_id]
    if total_units + LIVE_UNITS > units_total_cap:
        return "the scanner is resting for today, it hit its daily limit", None
    if int(live.get("total", 0)) + 1 > LIVE_SESSIONS_GLOBAL:
        return "channel 6 hit its daily session limit, try tomorrow", None
    if int(ips.get(ip_key, 0)) + 1 > LIVE_SESSIONS_PER_IP:
        return "you used today's live sessions for this network", None
    if sid is not None and int(sids.get(sid, 0)) + 1 > LIVE_SESSIONS_PER_SID:
        return "this session used its live tries, re-enter the invite code", None
    if len(active) >= CONCURRENT_LIVE:
        return "channel 6 is full right now, try again in a minute", None
    slot = secrets.token_urlsafe(9)
    active[slot] = now + SESSION_MAX_S + 20
    data["total"] = total_units + LIVE_UNITS
    live["total"] = int(live.get("total", 0)) + 1
    ips[ip_key] = int(ips.get(ip_key, 0)) + 1
    if sid is not None:
        sids[sid] = int(sids.get(sid, 0)) + 1
    return None, slot


def release_slot(data: dict, slot: str) -> bool:
    active = data.setdefault("live", {}).setdefault("active", {})
    return active.pop(slot, None) is not None


_local_lock = threading.Lock()
_local_day = ""
_local_data: dict = {}


def local_charge(ip: str, *, units_total_cap: int = 100000) -> tuple[str | None, str | None]:
    """Local mode: the same caps, in memory, per process."""
    global _local_day, _local_data
    with _local_lock:
        today = day_key()
        if today != _local_day:
            _local_day, _local_data = today, {}
        return check_and_count(_local_data, ip, None, units_total_cap=units_total_cap)


def local_release(slot: str) -> bool:
    with _local_lock:
        return release_slot(_local_data, slot)
