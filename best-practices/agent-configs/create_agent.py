#!/usr/bin/env python3
"""Create a NEW Atoms agent in your own organization from one folder under agents/.

Usage:
    uv run create_agent.py --list                               # the agents you can create
    uv run create_agent.py loan-collections-hi-en               # dry run: check the files, send nothing
    uv run create_agent.py loan-collections-hi-en --create      # create one new agent with your key

Each folder under agents/ holds agent-config.json and prompt.md.

What --create does, all through the smallestai Python SDK (5.12 or later):
  1. agents.create_agent(...)                   creates the agent with voice, language and call settings
  2. agent_versioning_branches.update_draft()   puts prompt.md and the end_call tool on the live branch
  3. Versioning.publish_and_wait() + make_live  publishes that draft and makes it live
  4. CallAnalytics.set_post_call_config()       adds the post-call summary and disposition metrics

This script only ever creates. It takes no agent id, so it cannot edit, publish,
call or delete an agent that already exists. Each --create makes another new
agent, so run it once. The new id is saved to agents/<name>/.created_agent_id
(git-ignored).

Reads SMALLEST_API_KEY from the environment or a .env file (--create only).
The key is never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
AGENTS = HERE / "agents"
ID_FILE_NAME = ".created_agent_id"

# Lightning v3.1 (waves_lightning_v3_1) retires on 30 Nov 2026. Agents use the Pro model.
TTS_MODEL = "waves_lightning_v3_1_pro"
# Filled in by the platform at call time, so they need no default value.
RUNTIME_VARIABLES = {"current_date", "current_time", "current_day"}

# agent-config.json key -> agents.create_agent() keyword
CREATE_FIELDS = {
    "name": "name",
    "description": "description",
    "workflowType": "workflow_type",
    "slmModel": "slm_model",
    "language": "language",
    "synthesizer": "synthesizer",
    "firstMessage": "first_message",
    "defaultVariables": "default_variables",
    "muteUserUntilFirstBotResponse": "mute_user_until_first_bot_response",
    "allowInterruptions": "allow_interruptions",
    "waitForUserToSpeakFirst": "wait_for_user_to_speak_first",
    "interruptionBackoffTimer": "interruption_backoff_timer",
    "smartTurnConfig": "smart_turn_config",
    "voiceDetectionConfig": "voice_detection_config",
    "voiceMailDetectionConfig": "voice_mail_detection_config",
    "denoisingConfig": "denoising_config",
    "redactionConfig": "redaction_config",
    "pronunciationDicts": "pronunciation_dicts",
    "llmIdleTimeoutConfig": "llm_idle_timeout_config",
    "sessionTimeoutConfig": "session_timeout_config",
    "timezone": "timezone",
    "backgroundSound": "background_sound",
    "enableStyleGuide": "enable_style_guide",
    "speechFormatting": "speech_formatting",
    "allowInboundCall": "allow_inbound_call",
}
OTHER_FIELDS = {"tools", "postCallAnalytics"}


def available() -> list[str]:
    return sorted(
        p.name for p in AGENTS.iterdir() if (p / "agent-config.json").is_file()
    )


def agent_dir(name: str) -> Path:
    if name not in available():
        msg = f"unknown agent {name!r}; choose one of {available()}"
        raise ValueError(msg)
    return AGENTS / name


def load(name: str) -> tuple[dict, str]:
    folder = agent_dir(name)
    cfg = json.loads((folder / "agent-config.json").read_text(encoding="utf-8"))
    prompt = (folder / "prompt.md").read_text(encoding="utf-8")
    return cfg, prompt


def variables_in(text: str) -> set[str]:
    return set(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", text))


def validate(cfg: dict, prompt: str) -> list[str]:
    """Return a list of problems. Empty means the config is safe to send."""
    problems = []
    unknown = set(cfg) - set(CREATE_FIELDS) - OTHER_FIELDS
    if unknown:
        problems.append(f"unknown keys in agent-config.json: {sorted(unknown)}")
    required = ("name", "workflowType", "firstMessage", "synthesizer", "language")
    problems.extend(
        f"agent-config.json is missing {key}" for key in required if key not in cfg
    )
    if cfg.get("workflowType") != "single_prompt":
        problems.append("workflowType must be single_prompt")
    model = ((cfg.get("synthesizer") or {}).get("voiceConfig") or {}).get("model")
    if model != TTS_MODEL:
        problems.append(
            f"synthesizer.voiceConfig.model is {model!r}; use {TTS_MODEL!r} "
            "(Lightning v3.1 retires on 30 Nov 2026)"
        )
    defined = set(cfg.get("defaultVariables") or {}) | RUNTIME_VARIABLES
    used = variables_in(prompt) | variables_in(cfg.get("firstMessage", ""))
    missing = sorted(used - defined)
    if missing:
        problems.append(f"variables used but not in defaultVariables: {missing}")
    names = [t.get("name") for t in cfg.get("tools") or []]
    if "end_call" not in names:
        problems.append("tools must include end_call")
    if not prompt.strip():
        problems.append("prompt.md is empty")
    return problems


def create_kwargs(cfg: dict) -> dict:
    return {kw: cfg[key] for key, kw in CREATE_FIELDS.items() if key in cfg}


def summary(cfg: dict, prompt: str) -> dict:
    pca = cfg.get("postCallAnalytics") or {}
    return {
        "name": cfg["name"],
        "slmModel": cfg.get("slmModel"),
        "voice": cfg["synthesizer"]["voiceConfig"],
        "language": cfg["language"].get("default"),
        "firstMessage": cfg["firstMessage"],
        "prompt": f"{len(prompt)} characters from prompt.md",
        "tools": [t["name"] for t in cfg.get("tools") or []],
        "dispositionMetrics": [
            m["identifier"] for m in pca.get("dispositionMetrics") or []
        ],
        "defaultVariables": sorted(cfg.get("defaultVariables") or {}),
    }


def _data(resp):
    return getattr(resp, "data", resp)


def pick_branch(branches) -> str:
    """The live branch of a brand-new agent (or its default branch)."""
    entries = list(branches or [])
    if not entries:
        raise RuntimeError(
            "the new agent has no branches yet; open it in the dashboard and try again"
        )
    for wanted in ("live", "default"):
        for entry in entries:
            branch = entry.branch
            if (wanted == "live" and entry.is_live) or (
                wanted == "default" and branch and branch.is_default
            ):
                return branch.id
    return entries[0].branch.id


def create(cfg: dict, prompt: str, client=None, analytics=None) -> str:
    """Create the agent and return its id. `client` and `analytics` are injectable for tests."""
    if client is None:
        from smallestai import SmallestAI

        client = SmallestAI()
    if analytics is None:
        from smallestai.atoms.helpers import CallAnalytics

        analytics = CallAnalytics()
    from smallestai.atoms.helpers import Versioning

    agent_id = str(_data(client.atoms.agents.create_agent(**create_kwargs(cfg))))
    print(f"Created agent {agent_id}")

    branches = client.atoms.agent_versioning_branches
    branch_id = pick_branch(_data(branches.list(id=agent_id)).branches)
    # The typed update_draft has no prompt field in SDK 5.14, so the single-prompt
    # section rides along as extra body; this is the same request AgentTools sends.
    branches.update_draft(
        id=agent_id,
        branch_id=branch_id,
        request_options={
            "additional_body_parameters": {
                "singlePromptConfig": {
                    "prompt": prompt,
                    "tools": cfg.get("tools") or [],
                },
            }
        },
    )
    Versioning(client).publish_and_wait(
        agent_id, branch_id, label="cookbook: prompt and tools"
    )
    branches.make_live(id=agent_id, branch_id=branch_id)
    print("Prompt and end_call tool published and live")

    pca = cfg.get("postCallAnalytics")
    if pca:
        analytics.set_post_call_config(
            agent_id=agent_id,
            summary_prompt=pca.get("summaryPrompt"),
            disposition_metrics=pca.get("dispositionMetrics"),
        )
        print(f"Post-call metrics set: {len(pca.get('dispositionMetrics') or [])}")
    return agent_id


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("agent", nargs="?", help="folder name under agents/")
    parser.add_argument(
        "--list", action="store_true", help="list the agents you can create"
    )
    parser.add_argument(
        "--create",
        action="store_true",
        help="really create the agent (default is a dry run)",
    )
    args = parser.parse_args(argv)

    if args.list or not args.agent:
        print("Agents you can create:")
        for name in available():
            print(f"  {name}")
        return 0 if args.list else 2
    try:
        cfg, prompt = load(args.agent)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    problems = validate(cfg, prompt)
    if problems:
        for p in problems:
            print(f"error: {p}", file=sys.stderr)
        return 2

    if not args.create:
        print("Dry run. Nothing was created. --create would make this agent:\n")
        print(json.dumps(summary(cfg, prompt), indent=2, ensure_ascii=False))
        return 0

    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass
    if not os.environ.get("SMALLEST_API_KEY"):
        print(
            "error: set SMALLEST_API_KEY in your environment or .env", file=sys.stderr
        )
        return 2

    agent_id = create(cfg, prompt)
    id_file = agent_dir(args.agent) / ID_FILE_NAME
    id_file.write_text(agent_id + "\n", encoding="utf-8")
    print(
        f"Saved the id to agents/{args.agent}/{ID_FILE_NAME}. "
        "Test it from the dashboard before any real call."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
