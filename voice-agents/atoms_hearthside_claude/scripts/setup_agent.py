#!/usr/bin/env python3
"""
Create (or look up) the Hearthside narrator agent on Smallest Atoms.

Reads SMALLEST_API_KEY from .env or environment, finds an existing agent
named "Hearthside Narrator" if one exists (idempotent), otherwise creates
it via POST /agent. Writes the resulting AGENT_ID into .env at the
project root.

Usage:
    cd voice-agents/atoms_hearthside_rn
    python scripts/setup_agent.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

AGENT_NAME = "Hearthside Narrator"
API_BASE = "https://api.smallest.ai/atoms/v1"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"

NARRATOR_SYSTEM_PROMPT = """\
You are the narrator of Hearthside, a voice-told story the listener
experiences in real time. Your voice is evocative, measured, and warm
without becoming sentimental. You do not address the listener as "you";
you narrate events in the second person only when a choice must be
resolved.

Genre: Victorian mystery. The listener is a detective in 1890s London,
called to investigate the disappearance of a clockmaker from Marylebone.

Opening scene (begin here): a narrow room above the clockmaker's shop,
a half-finished pendulum on the workbench, rain on the skylight, a
wet footprint at the foot of the stairs.

There are three branch points. At each, pause and invite a spoken
choice from the listener:
  1. Examine the workbench, or descend the stairs to the street?
  2. Follow the footprints north into the rookery, or south toward
     the railway?
  3. Confront the suspect alone, or return to summon a constable?

Rules of the narration:
 - Keep each narrator turn under forty seconds of speech. Short
   sentences. Concrete sensory detail. No rhetorical questions except
   the three branch prompts.
 - When the listener says "wait" or asks to repeat, rewind to the
   previous branch and offer the same choice again, phrased slightly
   differently.
 - When the listener says "end the story" or "I'm done", resolve the
   current branch in two or three sentences and close with a single
   line of coda.
 - Treat silence of more than ten seconds as hesitation; gently offer
   the choices again before continuing.
 - If the listener makes an unrelated remark, acknowledge it in one
   line in voice and return to the choice.
 - Never break character. Never mention the protocol, the app, or
   your own construction.

Resolve the mystery in your final branch in at most three sentences,
and close with the line: "And the clock kept its own time, after all."
"""


def load_dotenv(path: Path) -> dict[str, str]:
    """Minimal .env reader. Ignores quoting quirks; this is single-user config."""
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def write_env(path: Path, updates: dict[str, str]) -> None:
    """Rewrite .env preserving existing keys and line order."""
    if path.exists():
        lines = path.read_text().splitlines()
    else:
        lines = []
    seen: set[str] = set()
    out_lines: list[str] = []
    for line in lines:
        if line.strip().startswith("#") or "=" not in line:
            out_lines.append(line)
            continue
        key = line.split("=", 1)[0].strip()
        if key in updates:
            out_lines.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out_lines.append(line)
    for key, val in updates.items():
        if key not in seen:
            out_lines.append(f"{key}={val}")
    path.write_text("\n".join(out_lines) + "\n")


def api_request(method: str, path: str, api_key: str, body: Optional[dict] = None) -> dict:
    url = f"{API_BASE}{path}"
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        method=method,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"API error on {method} {path}: {e.code} {detail}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Network error on {method} {path}: {e.reason}")


def find_existing_agent(api_key: str, name: str) -> Optional[str]:
    """Best-effort idempotency check. Returns agent_id if one with this
    name is already owned by the caller, otherwise None."""
    try:
        resp = api_request("GET", "/agent", api_key)
    except SystemExit:
        return None
    items = resp.get("data") or resp.get("agents") or resp.get("items") or []
    if not isinstance(items, list):
        return None
    for a in items:
        if not isinstance(a, dict):
            continue
        if a.get("name") == name:
            return a.get("id") or a.get("agent_id") or a.get("_id")
    return None


def create_agent(api_key: str) -> str:
    body = {
        "name": AGENT_NAME,
        "description": "Voice-told Victorian mystery narrator for the Hearthside cookbook sample.",
        "system_prompt": NARRATOR_SYSTEM_PROMPT,
        "model": "gpt-4.1",
        "language": "en",
        # Voice id is picked by the user. Any narration-leaning voice id from
        # the catalogue works; substitute the id you prefer.
        "voice_id": "emily",
        "temperature": 0.4,
    }
    resp = api_request("POST", "/agent", api_key, body)
    agent_id = resp.get("id") or resp.get("agent_id") or resp.get("_id")
    if not agent_id:
        raise SystemExit(f"Unexpected /agent response: {json.dumps(resp)[:400]}")
    return str(agent_id)


def main() -> int:
    env = load_dotenv(ENV_PATH)
    api_key = env.get("SMALLEST_API_KEY") or os.environ.get("SMALLEST_API_KEY")
    if not api_key or not api_key.startswith("sk_"):
        print(
            "SMALLEST_API_KEY not set. Copy .env.example to .env and paste your key\n"
            "from https://app.smallest.ai/dashboard/api-keys.",
            file=sys.stderr,
        )
        return 1

    existing = find_existing_agent(api_key, AGENT_NAME)
    if existing:
        print(f"Found existing agent '{AGENT_NAME}' -> {existing}")
        agent_id = existing
    else:
        print(f"Creating agent '{AGENT_NAME}'...")
        agent_id = create_agent(api_key)
        print(f"Created -> {agent_id}")

    # Write EXPO_PUBLIC_* too so the values are visible at Metro bundle time.
    write_env(ENV_PATH, {
        "SMALLEST_API_KEY": api_key,
        "AGENT_ID": agent_id,
        "EXPO_PUBLIC_SMALLEST_API_KEY": api_key,
        "EXPO_PUBLIC_AGENT_ID": agent_id,
    })
    print(f"Wrote {ENV_PATH}. Next: `npx expo prebuild && npx expo run:ios` (or run:android).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
