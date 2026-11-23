#!/usr/bin/env python3
"""Booking agent that retries when a call fails, goes unanswered, or hits voicemail.

Commands:
    uv run booking_retry.py policy                    # print the retry schedule
    uv run booking_retry.py simulate                  # replay fixtures on a virtual clock, no network
    uv run booking_retry.py run --i-have-consent      # real calls through your Atoms agent
    uv run booking_retry.py status                    # show the ledger

`simulate` never touches the network and needs no API key. `run` places real
phone calls, so it refuses to start unless every safety check passes. See the
README for the list.

Environment (only `run` reads these):
    SMALLEST_API_KEY            your Atoms API key (read by the SDK, never printed)
    ATOMS_AGENT_ID              24 character id of YOUR booking agent
    BOOKING_ALLOWED_PREFIXES    country codes you may call, for example +1,+91
    ATOMS_FROM_PRODUCT_ID       optional, the number to call from
"""

from __future__ import annotations

import argparse
import logging
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from dialer import AtomsDialer, ScriptedDialer  # noqa: E402
from guard import InputError, load_contacts, parse_prefixes  # noqa: E402
from ledger import Ledger  # noqa: E402
from policy import Policy  # noqa: E402
from report import render, timeline  # noqa: E402
from runner import LiveLimits, Runner  # noqa: E402

DEFAULT_DB = "booking_retry.sqlite"


def print_policy(policy: Policy) -> None:
    print(f"max attempts          {policy.max_attempts} (first call plus {policy.max_attempts - 1} retries)")
    print(f"no answer delays      {', '.join(str(m) for m in policy.no_answer_delays_min)} minutes, last value repeats")
    print(f"voicemail delays      {', '.join(str(m) for m in policy.voicemail_delays_min)} minutes, stop after {policy.max_voicemails}")
    print(f"failure backoff       {policy.failure_base_min} min doubling, capped at {policy.failure_cap_min} min")
    print(f"give up after         {policy.give_up_after_hours} hours")
    print(f"jitter                +/- {int(policy.jitter * 100)} percent")
    days = "Mon Tue Wed Thu Fri Sat Sun".split()
    print(
        f"calling window        {policy.window_start_hour:02d}:00 to {policy.window_end_hour:02d}:00 "
        f"contact local time, {' '.join(days[d] for d in policy.window_weekdays)}"
    )
    print("never retried         booked, declined, callback requested, do not call, wrong number,")
    print("                      hung up at once, cancelled, blocked, or any call where a person talked")


def cmd_simulate(args: argparse.Namespace) -> int:
    contacts = load_contacts(Path(args.contacts))
    # A virtual clock jumps straight to the next due retry, so days pass in a blink.
    start = datetime(2026, 12, 1, 9, 30, tzinfo=timezone.utc)
    clock = {"t": start}
    ledger = Ledger(args.db)
    dialer = ScriptedDialer.from_file(Path(args.scenarios))
    # jitter, not cryptography
    runner = Runner(ledger, dialer, Policy(), now=lambda: clock["t"], rng=random.Random(7))  # nosec B311
    runner.enqueue(contacts)

    for _ in range(500):  # hard stop so a bug can never loop forever
        runner.run_due()
        nxt = ledger.next_due_at()
        if nxt is None:
            break
        clock["t"] = max(nxt, clock["t"] + timedelta(seconds=1))
    print(render(ledger))
    print()
    for c in contacts:
        print(timeline(ledger, c.id))
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    if not args.i_have_consent:
        raise InputError("pass --i-have-consent to confirm every person in the file agreed to be called")
    allowed = parse_prefixes(os.environ.get("BOOKING_ALLOWED_PREFIXES", ""))
    if not allowed:
        raise InputError("set BOOKING_ALLOWED_PREFIXES, for example +1,+91, to say which countries you may call")
    agent_id = os.environ.get("ATOMS_AGENT_ID", "")
    if not os.environ.get("SMALLEST_API_KEY"):
        raise InputError("set SMALLEST_API_KEY in your environment")
    if not agent_id:
        raise InputError("set ATOMS_AGENT_ID to the id of your booking agent")

    contacts = load_contacts(Path(args.contacts))
    from smallestai import SmallestAI  # imported late so simulate works without it

    dialer = AtomsDialer(
        SmallestAI(),
        agent_id,
        from_product_id=os.environ.get("ATOMS_FROM_PRODUCT_ID") or None,
        test_call=args.test_call,
    )
    ledger = Ledger(args.db)
    runner = Runner(ledger, dialer, Policy(), live=LiveLimits(allowed, args.max_calls))
    added = runner.enqueue(contacts)
    logging.getLogger("booking_retry").info("%d new requests, %d already in the ledger", added, len(contacts) - added)
    runner.recover()

    while True:
        runner.run_due()
        nxt = ledger.next_due_at()
        if nxt is None or not args.watch:
            break
        wait = max((nxt - datetime.now().astimezone()).total_seconds(), 30)
        logging.getLogger("booking_retry").info("next retry in %d minutes", wait // 60)
        time.sleep(min(wait, 300))
    print(render(ledger))
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    print(render(Ledger(args.db)))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("policy", help="print the retry schedule").set_defaults(func=lambda a: print_policy(Policy()) or 0)

    sim = sub.add_parser("simulate", help="replay fixtures on a virtual clock, no network")
    sim.add_argument("--contacts", default=str(HERE / "contacts.sample.csv"))
    sim.add_argument("--scenarios", default=str(HERE / "fixtures" / "scenarios.json"))
    sim.add_argument("--db", default=":memory:")
    sim.set_defaults(func=cmd_simulate)

    run = sub.add_parser("run", help="place real calls through your Atoms agent")
    run.add_argument("--contacts", required=True, help="CSV of people who agreed to be called")
    run.add_argument("--db", default=DEFAULT_DB)
    run.add_argument("--i-have-consent", action="store_true", help="confirm everyone in the CSV consented")
    run.add_argument("--max-calls", type=int, default=5, help="cap on calls placed per run (default 5)")
    run.add_argument("--test-call", action="store_true", help="mark calls as test calls on the platform")
    run.add_argument("--watch", action="store_true", help="stay running and place retries as they come due")
    run.set_defaults(func=cmd_run)

    st = sub.add_parser("status", help="show the ledger")
    st.add_argument("--db", default=DEFAULT_DB)
    st.set_defaults(func=cmd_status)
    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
    args = build_parser().parse_args(argv)
    if getattr(args, "max_calls", 1) < 1 or getattr(args, "max_calls", 1) > 100:
        print("error: --max-calls must be between 1 and 100", file=sys.stderr)
        return 2
    try:
        return args.func(args)
    except InputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
