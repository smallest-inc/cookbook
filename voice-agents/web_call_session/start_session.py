#!/usr/bin/env python3
"""
Web Call Session

Starts a browser voice (or text chat) session for an Atoms agent from the
server side. The API key stays on the server; the browser only receives the
short-lived token, host, and room name it needs to join the session.

Usage:
    python start_session.py --agent-id <AGENT_ID>
    python start_session.py --agent-id <AGENT_ID> --chat
    AGENT_ID=... python start_session.py
"""

import argparse
import os
import sys

from dotenv import load_dotenv
from smallestai import SmallestAI

load_dotenv()


def main():
    parser = argparse.ArgumentParser(description="Start a web call or web chat session for an agent")
    parser.add_argument(
        "--agent-id",
        default=os.getenv("AGENT_ID"),
        help="Atoms agent ID (defaults to AGENT_ID env var)",
    )
    parser.add_argument(
        "--chat",
        action="store_true",
        help="Start a text chat session instead of a voice call",
    )
    args = parser.parse_args()

    if not args.agent_id:
        print("Error: pass --agent-id or set AGENT_ID", file=sys.stderr)
        sys.exit(1)

    client = SmallestAI()  # reads SMALLEST_API_KEY from the environment

    if args.chat:
        print("Starting web chat session...")
        response = client.atoms.web_call.start_web_chat_conversation(agent_id=args.agent_id)
    else:
        print("Starting web call session...")
        response = client.atoms.web_call.start_web_call_conversation(agent_id=args.agent_id)

    session = response.data

    # token + host go to the browser room client; the rest stays server-side.
    print(f"  token:           {session.token}")
    print(f"  room_name:       {session.room_name}")
    print(f"  host:            {session.host}")
    print(f"  conversation_id: {session.conversation_id}")
    print(f"  call_id:         {session.call_id}")

    print("\nAfter the call, fetch details with:")
    print(f'  client.atoms.calls.get(id="{session.conversation_id}")')


if __name__ == "__main__":
    main()
