#!/usr/bin/env python3
"""Create a NEW booking agent from agent-config.example.json.

Usage:
    uv run create_agent.py            # dry run: print what would be created, call nothing
    uv run create_agent.py --create   # create one new agent on your account

This script only ever creates. It never edits or deletes an existing agent, so
running it cannot change an agent you already use. Each --create makes another
new agent, so run it once.

Reads SMALLEST_API_KEY from the environment (--create only). The key is never printed.

The SDK creates the agent shell, voicemail detection and post-call metrics.
The prompt is not set here: paste prompt.md into the agent's prompt box in the
dashboard and publish. Then put the agent id in ATOMS_AGENT_ID.
"""

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "agent-config.example.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--create", action="store_true", help="really create the agent (default is a dry run)")
    args = parser.parse_args()

    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    summary = {k: cfg[k] for k in ("name", "workflowType", "slmModel", "firstMessage")}
    summary["voiceMailDetectionConfig"] = cfg["voiceMailDetectionConfig"]
    summary["dispositionMetrics"] = [m["identifier"] for m in cfg["postCallAnalytics"]["dispositionMetrics"]]

    if not args.create:
        print("Dry run. Nothing was created. This is what --create would send:\n")
        print(json.dumps(summary, indent=2))
        return 0

    if not os.environ.get("SMALLEST_API_KEY"):
        print("error: set SMALLEST_API_KEY in your environment", file=sys.stderr)
        return 2

    from smallestai import SmallestAI
    from smallestai.atoms.helpers import CallAnalytics

    client = SmallestAI()
    created = client.atoms.agents.create_agent(
        name=cfg["name"],
        description=cfg["description"],
        workflow_type=cfg["workflowType"],
        slm_model=cfg["slmModel"],
        language=cfg["language"],
        first_message=cfg["firstMessage"],
        default_variables=cfg["defaultVariables"],
        voice_mail_detection_config=cfg["voiceMailDetectionConfig"],
        session_timeout_config=cfg["sessionTimeoutConfig"],
        redaction_config=cfg["redactionConfig"],
    )
    agent_id = str(getattr(created, "data", created))

    CallAnalytics().set_post_call_config(
        agent_id=agent_id,
        summary_prompt=cfg["postCallAnalytics"]["summaryPrompt"],
        disposition_metrics=cfg["postCallAnalytics"]["dispositionMetrics"],
    )

    print(f"Created agent {agent_id}")
    print("Next: paste prompt.md into the agent's prompt box, publish, then set ATOMS_AGENT_ID.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
