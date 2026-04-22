#!/usr/bin/env python3
"""
Provision the Hearthside narrator agent on Smallest Atoms.

Two modes, chosen automatically from .env:

  1. Existing agent  — If AGENT_ID is already set in .env, this script
     prints a confirmation and exits. No API key required. Use this when
     you created the agent in the dashboard and just want to wire it up.

  2. Create-or-update — If AGENT_ID is missing, requires SMALLEST_API_KEY.
     Looks up an existing agent by name; if found, updates its config in
     place. Otherwise creates a fresh agent. In both cases: opens a draft,
     writes the full single-prompt config (prompt, voice, language,
     model), and publishes the draft as a new version. Writes AGENT_ID
     (and EXPO_PUBLIC_* mirrors for Metro bundle inlining) into .env.

Usage:
    cd voice-agents/atoms_hearthside_rn
    python scripts/setup_agent.py                 # default narrator
    python scripts/setup_agent.py --voice jasmine # override voice
    python scripts/setup_agent.py --model gpt-4o  # override LLM
    python scripts/setup_agent.py --name "My Narrator"   # override agent name

Reference: https://docs.smallest.ai/atoms/api-reference
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

API_BASE = "https://api.smallest.ai/atoms/v1"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"

DEFAULT_AGENT_NAME = "Hearthside Narrator"
DEFAULT_SLM        = "gpt-4o"    # "electron" is the cheaper alternative
DEFAULT_LANGUAGE   = "en"
# Synthesizer is intentionally omitted by default. The backend picks its
# own default voice/model when the field is absent, which matches what
# the dashboard renders. Pass --voice / --voice-model to override.

NARRATOR_PROMPT = """\
You are the narrator of Hearthside, a voice-told story the listener
experiences in real time. Your voice is evocative, measured, and warm
without becoming sentimental. You narrate events in prose.

Genre: Victorian mystery. The listener is a detective in 1890s London,
called to investigate the disappearance of a clockmaker from Marylebone.

Opening scene (begin here as soon as the session starts): a narrow room
above the clockmaker's shop, a half-finished pendulum on the workbench,
rain on the skylight, a wet footprint at the foot of the stairs.

There are three branch points. At each, pause and invite a spoken
choice from the listener:

  1. Examine the workbench, or descend the stairs to the street?
  2. Follow the footprints north into the rookery, or south toward
     the railway?
  3. Confront the suspect alone, or return to summon a constable?

Rules of the narration:

 - Keep each narrator turn under forty seconds of speech. Short
   sentences. Concrete sensory detail.
 - When the listener says "wait" or asks to repeat, rewind to the
   previous branch and offer the same choice again, phrased slightly
   differently.
 - When the listener says "end the story" or "I am done", resolve the
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

# ───────────────────────── env file helpers ─────────────────────────

def load_dotenv(path: Path) -> dict[str, str]:
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
    lines = path.read_text().splitlines() if path.exists() else []
    seen: set[str] = set()
    out_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            out_lines.append(line)
            continue
        key = stripped.split("=", 1)[0].strip()
        if key in updates:
            out_lines.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out_lines.append(line)
    for key, val in updates.items():
        if key not in seen:
            out_lines.append(f"{key}={val}")
    path.write_text("\n".join(out_lines) + "\n")


# ───────────────────────── HTTP layer ─────────────────────────

class ApiError(RuntimeError):
    def __init__(self, method: str, path: str, status: int, body: str):
        super().__init__(f"{method} {path} -> {status}: {body[:500]}")
        self.status = status
        self.body = body


def api_request(method: str, path: str, api_key: str, body: Optional[dict[str, Any]] = None) -> Any:
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            parsed = json.loads(raw) if raw.strip().startswith("{") or raw.strip().startswith("[") else raw
            return parsed
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise ApiError(method, path, e.code, detail)
    except urllib.error.URLError as e:
        raise SystemExit(f"Network error on {method} {path}: {e.reason}")


def unwrap_data(resp: Any) -> Any:
    """Atoms responses wrap payloads in `{status, data}`. Some endpoints
    return a bare string as `data`. Accept both shapes."""
    if isinstance(resp, dict) and "data" in resp:
        return resp["data"]
    return resp


# ───────────────────────── agent lifecycle ─────────────────────────

def find_agent_by_name(api_key: str, name: str) -> Optional[str]:
    try:
        resp = api_request("GET", "/agent?offset=100", api_key)
    except ApiError:
        return None
    data = unwrap_data(resp)
    agents = data.get("agents") if isinstance(data, dict) else None
    if not isinstance(agents, list):
        return None
    for a in agents:
        if isinstance(a, dict) and a.get("name") == name:
            return a.get("_id") or a.get("id")
    return None


def create_agent(api_key: str, name: str, slm: str, language: str,
                 voice_id: Optional[str], voice_model: Optional[str]) -> str:
    # If voice_id is None, synthesizer is omitted so the backend picks a
    # default — the safest choice for readers who don't know the voice
    # catalog. Callers who want a specific voice pass --voice.
    body: dict[str, Any] = {
        "name": name,
        "description": "Voice-told Victorian mystery narrator for the Hearthside cookbook sample.",
        "language": {
            "default": language,
            "supported": [language],
            "switching": {"isEnabled": False},
        },
        "slmModel": slm,
        "workflowType": "single_prompt",
    }
    if voice_id:
        body["synthesizer"] = {
            "voiceConfig": {
                "model":   voice_model or "waves_lightning_v3_1",
                "voiceId": voice_id,
            },
            "speed": 1.0,
        }
    resp = api_request("POST", "/agent", api_key, body)
    agent_id = unwrap_data(resp)
    if not isinstance(agent_id, str) or len(agent_id) < 8:
        raise SystemExit(f"Unexpected /agent response: {json.dumps(resp)[:400]}")
    return agent_id


def fetch_published_version_id(api_key: str, agent_id: str) -> Optional[str]:
    resp = api_request("GET", f"/agent/{agent_id}/versions?limit=1", api_key)
    data = unwrap_data(resp)
    items = data.get("versions") if isinstance(data, dict) else data
    if isinstance(items, list) and items:
        v = items[0]
        return v.get("_id") or v.get("id") or v.get("versionId")
    return None


def fetch_or_create_draft(api_key: str, agent_id: str, source_version_id: Optional[str]) -> str:
    # AgentVersion has two id fields: _id (mongo record id) and draftId
    # (the routing identifier used on PATCH/PUBLISH paths). We must use
    # draftId for API routes, not _id.
    try:
        resp = api_request("GET", f"/agent/{agent_id}/drafts", api_key)
        drafts = unwrap_data(resp)
        if isinstance(drafts, list) and drafts:
            d = drafts[0]
            draft_id = d.get("draftId")
            if draft_id:
                return draft_id
    except ApiError:
        pass

    body: dict[str, Any] = {"draftName": "hearthside-setup"}
    if source_version_id:
        body["sourceVersionId"] = source_version_id
    resp = api_request("POST", f"/agent/{agent_id}/drafts", api_key, body)
    data = unwrap_data(resp)
    draft_id = data.get("draftId") if isinstance(data, dict) else None
    if not draft_id:
        raise SystemExit(f"Unexpected /drafts response (no draftId): {json.dumps(resp)[:400]}")
    return draft_id


def patch_draft_config(api_key: str, agent_id: str, draft_id: str, *,
                       slm: str, language: str, prompt: str,
                       voice_id: Optional[str], voice_model: Optional[str]) -> None:
    body: dict[str, Any] = {
        "language": {
            "default": language,
            "supported": [language],
            "switching": {"isEnabled": False},
        },
        "slmModel": slm,
        "singlePromptConfig": {
            "prompt": prompt,
            "tools": [],
        },
    }
    if voice_id:
        body["synthesizer"] = {
            "voiceConfig": {
                "model":   voice_model or "waves_lightning_v3_1",
                "voiceId": voice_id,
            },
            "speed": 1.0,
        }
    api_request("PATCH", f"/agent/{agent_id}/drafts/{draft_id}/config", api_key, body)


def publish_draft(api_key: str, agent_id: str, draft_id: str) -> str:
    """Publish a draft; returns the new version id (needed for activation)."""
    resp = api_request("POST", f"/agent/{agent_id}/drafts/{draft_id}/publish", api_key,
                       {"label": f"hearthside-{int(time.time())}"})
    data = unwrap_data(resp)
    version_id = data.get("_id") if isinstance(data, dict) else None
    if not version_id:
        raise SystemExit(f"Publish did not return a version id: {json.dumps(resp)[:400]}")
    return version_id


def activate_version(api_key: str, agent_id: str, version_id: str) -> None:
    api_request("PATCH", f"/agent/{agent_id}/versions/{version_id}/activate", api_key)


def verify_agent_exists(api_key: str, agent_id: str) -> bool:
    try:
        api_request("GET", f"/agent/{agent_id}", api_key)
        return True
    except ApiError as e:
        if e.status == 404:
            return False
        raise


# ───────────────────────── entry point ─────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name",     default=DEFAULT_AGENT_NAME, help="agent name")
    parser.add_argument("--model",    default=DEFAULT_SLM, choices=["electron", "gpt-4o"],
                        help="slmModel (LLM driving the agent)")
    parser.add_argument("--language", default=DEFAULT_LANGUAGE, choices=["en", "hi", "ta"],
                        help="primary language")
    parser.add_argument("--voice",    default=None,
                        help="voiceId to pin (example: magnus, daniel, nyah). "
                             "Omit to let the backend pick a default voice that "
                             "renders correctly in the dashboard.")
    parser.add_argument("--voice-model", default=None,
                        help="Synthesizer model to pair with --voice. Defaults to "
                             "waves_lightning_v3_1 when --voice is passed.")
    parser.add_argument("--force-create", action="store_true",
                        help="ignore existing AGENT_ID in .env and run the full create flow")
    args = parser.parse_args()

    env = load_dotenv(ENV_PATH)
    api_key = env.get("SMALLEST_API_KEY") or os.environ.get("SMALLEST_API_KEY")
    existing_id = env.get("AGENT_ID")

    # Mode 1: AGENT_ID already set. Skip creation unless --force-create.
    if existing_id and not args.force_create:
        if not api_key:
            print(f"Using existing AGENT_ID={existing_id} from .env. Skipping creation.")
            print("No API key needed for this path. Run `npx expo run:ios` next.")
            return 0
        if verify_agent_exists(api_key, existing_id):
            print(f"Found AGENT_ID={existing_id} on your account. Skipping creation.")
            _mirror_env_for_expo(api_key, existing_id)
            return 0
        print(f"AGENT_ID={existing_id} not reachable; running create flow instead.")

    if not api_key or not re.match(r"^sk_", api_key):
        print("SMALLEST_API_KEY missing or invalid. Copy .env.example to .env and paste your\n"
              "key from https://app.smallest.ai/dashboard/api-keys.", file=sys.stderr)
        return 1

    # Mode 2: create or update by name.
    print(f"Looking up agent '{args.name}'...")
    agent_id = find_agent_by_name(api_key, args.name)
    if agent_id:
        print(f"  found existing agent: {agent_id}. Will update its config in place.")
    else:
        print("  not found. Creating...")
        agent_id = create_agent(api_key, args.name, args.model, args.language,
                                args.voice, args.voice_model)
        print(f"  created agent: {agent_id}")

    print("Opening draft for config edit...")
    version_id = fetch_published_version_id(api_key, agent_id)
    draft_id = fetch_or_create_draft(api_key, agent_id, version_id)
    print(f"  draft: {draft_id}")

    print("Writing prompt, LLM, and language into draft...")
    patch_draft_config(api_key, agent_id, draft_id,
                       slm=args.model, language=args.language,
                       prompt=NARRATOR_PROMPT,
                       voice_id=args.voice, voice_model=args.voice_model)

    print("Publishing draft...")
    new_version_id = publish_draft(api_key, agent_id, draft_id)
    print(f"  published as version {new_version_id}.")

    print("Activating new version...")
    activate_version(api_key, agent_id, new_version_id)
    print("  activated (new config is live).")

    _mirror_env_for_expo(api_key, agent_id)
    print(f"\nDone. Agent ID -> {agent_id}")
    print("Next: `npx expo prebuild && npx expo run:ios` (or run:android).")
    return 0


def _mirror_env_for_expo(api_key: str, agent_id: str) -> None:
    write_env(ENV_PATH, {
        "SMALLEST_API_KEY": api_key,
        "AGENT_ID": agent_id,
        "EXPO_PUBLIC_SMALLEST_API_KEY": api_key,
        "EXPO_PUBLIC_AGENT_ID": agent_id,
    })
    print(f"Wrote {ENV_PATH}.")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ApiError as e:
        print(f"API error: {e}", file=sys.stderr)
        raise SystemExit(2)
