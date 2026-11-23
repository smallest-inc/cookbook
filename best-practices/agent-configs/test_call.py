#!/usr/bin/env python3
"""Place ONE test call from the collections agent you created to a phone number you own.

Only for agents/loan-collections-hi-en, the outbound agent. The EMI agent is
inbound: attach a number to it in the dashboard and call that number instead.

Usage:
    uv run test_call.py --to +91XXXXXXXXXX                                   # dry run, places nothing
    uv run test_call.py --to +91XXXXXXXXXX --i-own-this-number --call        # place the test call

Rules this script enforces before it dials:
  * it only uses the agent id that create_agent.py saved in
    agents/loan-collections-hi-en/.created_agent_id,
    so it cannot call through any other agent
  * the number must be E.164 (+ and country code) and you must confirm you own it
  * it refuses outside 08:00 to 19:00 in --timezone (default Asia/Kolkata), the
    window RBI allows for recovery calls
  * the call is marked as a test call and uses the fictional defaultVariables
    from agent-config.json; --name lets the agent greet you by your own name

Reads SMALLEST_API_KEY from the environment or a .env file. The key is never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
AGENT_DIR = HERE / "agents" / "loan-collections-hi-en"
ID_FILE = AGENT_DIR / ".created_agent_id"
CONFIG = AGENT_DIR / "agent-config.json"

CALL_WINDOW = (time(8, 0), time(19, 0))
E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def within_call_window(now: datetime) -> bool:
    """True if `now` (timezone-aware, in the customer's zone) is between 08:00 and 19:00."""
    start, end = CALL_WINDOW
    return start <= now.time() < end


def created_agent_id() -> str | None:
    if not ID_FILE.is_file():
        return None
    value = ID_FILE.read_text(encoding="utf-8").strip()
    return value or None


def call_variables(name: str | None) -> dict:
    variables = dict(
        json.loads(CONFIG.read_text(encoding="utf-8")).get("defaultVariables") or {}
    )
    if name:
        variables["customer_name"] = name
    return variables


def main(
    argv: list[str] | None = None, now: datetime | None = None, client=None
) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--to", required=True, help="your own phone number in E.164, e.g. +91XXXXXXXXXX"
    )
    parser.add_argument(
        "--name",
        help="the name the agent should greet you by (default: the fictional customer)",
    )
    parser.add_argument(
        "--timezone",
        default="Asia/Kolkata",
        help="IANA zone of the number you are calling",
    )
    parser.add_argument(
        "--i-own-this-number", action="store_true", help="confirm the number is yours"
    )
    parser.add_argument(
        "--call",
        action="store_true",
        help="really place the call (default is a dry run)",
    )
    args = parser.parse_args(argv)

    if not E164.match(args.to):
        print("error: --to must be E.164, for example +91XXXXXXXXXX", file=sys.stderr)
        return 2
    try:
        zone = ZoneInfo(args.timezone)
    except (KeyError, ValueError):
        print(f"error: unknown timezone {args.timezone!r}", file=sys.stderr)
        return 2
    local_now = (now or datetime.now(zone)).astimezone(zone)
    if not within_call_window(local_now):
        print(
            f"error: it is {local_now:%H:%M} in {args.timezone}. Collections calls are only "
            "placed between 08:00 and 19:00 local time.",
            file=sys.stderr,
        )
        return 3
    agent_id = created_agent_id()
    if not agent_id:
        print(
            "error: no agents/loan-collections-hi-en/.created_agent_id. Run "
            "`uv run create_agent.py loan-collections-hi-en --create` first; "
            "this script only calls through the agent you created.",
            file=sys.stderr,
        )
        return 2

    variables = call_variables(args.name)
    masked = args.to[:3] + "*" * (len(args.to) - 6) + args.to[-3:]
    if not (args.call and args.i_own_this_number):
        print(
            f"Dry run. Would place one test call from agent {agent_id} to {masked} "
            f"at {local_now:%H:%M} {args.timezone}, greeting {variables.get('customer_name')!r}."
        )
        print("Add --i-own-this-number --call to place it.")
        return 0

    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass
    if client is None:
        if not os.environ.get("SMALLEST_API_KEY"):
            print(
                "error: set SMALLEST_API_KEY in your environment or .env",
                file=sys.stderr,
            )
            return 2
        from smallestai import SmallestAI

        client = SmallestAI()
    resp = client.atoms.calls.start_outbound_call(
        agent_id=agent_id,
        phone_number=args.to,
        test_call="true",
        variables=variables,
    )
    data = getattr(resp, "data", resp)
    call_id = (
        getattr(data, "conversation_id", None) or getattr(data, "call_id", None) or data
    )
    print(f"Test call started to {masked}: {call_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
