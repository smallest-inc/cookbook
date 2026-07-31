"""Place an outbound call from the crew agent.

Usage:
    uv run outbound.py --to +14155551234
    uv run outbound.py --to +14155551234 --from-product-id prod_xxx

Reads SMALLEST_API_KEY and ATOMS_AGENT_ID from env / .env. If
--from-product-id is omitted, the agent's default attached number
is used.
"""

import argparse
import os
import sys
import time

from smallestai import SmallestAI


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--to", required=True, help="Destination in E.164 (e.g. +14155551234)")
    parser.add_argument("--from-product-id", default=None, help="Rented number's product ID (optional)")
    parser.add_argument("--poll", action="store_true", help="Poll call status until it terminates")
    args = parser.parse_args()

    agent_id = os.environ.get("ATOMS_AGENT_ID")
    if not agent_id:
        sys.exit("Set ATOMS_AGENT_ID in your env (or .env).")

    client = SmallestAI()

    call = client.atoms.calls.start_outbound_call(
        agent_id=agent_id,
        phone_number=args.to,
        from_product_id=args.from_product_id,
    ).data
    call_id = call.conversation_id
    print(f"Queued call {call_id} → {args.to}")

    if not args.poll:
        print(f"Track with: client.atoms.calls.get(id='{call_id}')")
        return

    # Poll for terminal status.
    terminal = {"completed", "no_answer", "busy", "failed", "canceled"}
    while True:
        time.sleep(3)
        state = client.atoms.calls.get(id=call_id).data
        status = getattr(state, "status", None) or getattr(state, "call_status", "unknown")
        print(f"  status={status}")
        if status in terminal:
            break

    print(f"Call {call_id} finished with status={status}")


if __name__ == "__main__":
    main()
