import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

import booking_retry
from dialer import ScriptedDialer
from guard import Contact
from ledger import Ledger
from policy import VOICEMAIL_MARKER, Policy, _squash
from runner import LiveLimits, Runner

ROOT = Path(__file__).resolve().parents[1]
START = datetime(2026, 12, 1, 14, 0, tzinfo=timezone.utc)  # 09:00 in New York


class Clock:
    def __init__(self, t=START):
        self.t = t

    def __call__(self):
        return self.t


def contact(n=1, tz="America/New_York"):
    return Contact(f"c{n}", f"Test Person {n}", f"+1202555{n:04d}", tz, "checkup", "demo")


def build(scenarios, live=None, policy=None, clock=None):
    clock = clock or Clock()
    dialer = ScriptedDialer(scenarios)
    ledger = Ledger()
    runner = Runner(ledger, dialer, policy or Policy(), now=clock, rng=random.Random(3), live=live)
    return runner, ledger, dialer, clock


def drain(runner, ledger, clock, limit=200):
    for _ in range(limit):
        runner.run_due()
        nxt = ledger.next_due_at()
        if nxt is None:
            return
        clock.t = max(nxt, clock.t + timedelta(seconds=1))
    raise AssertionError("did not settle")


def test_booked_on_first_call_is_not_retried():
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"status": "completed", "duration": 50,
                                                      "metrics": {"booking_status": "booked"}}]})
    runner.enqueue([c])
    drain(runner, ledger, clock)
    r = ledger.get("c1")
    assert (r.status, r.outcome, r.attempts) == ("done", "booked", 1)
    assert len(dialer.placed) == 1


def test_no_answer_twice_then_booked():
    c = contact()
    steps = [{"status": "no_answer"}, {"status": "no_answer"},
             {"status": "completed", "duration": 40, "metrics": {"booking_status": "booked"}}]
    runner, ledger, dialer, clock = build({c.phone: steps})
    runner.enqueue([c])
    drain(runner, ledger, clock)
    r = ledger.get("c1")
    assert (r.outcome, r.attempts) == ("booked", 3)
    gaps = [datetime.fromisoformat(a["started_at"]) for a in ledger.attempts_for("c1")]
    assert gaps[1] - gaps[0] >= timedelta(minutes=13)
    assert gaps[2] - gaps[1] >= timedelta(minutes=50)


def test_voicemail_is_detected_from_the_marker_and_retried_later():
    c = contact()
    vm = {"status": "completed", "duration": 12, "agent_text": f"Sorry I missed you. {VOICEMAIL_MARKER}."}
    runner, ledger, dialer, clock = build({c.phone: [vm, {"status": "completed", "duration": 30,
                                                         "metrics": {"booking_status": "booked"}}]})
    runner.enqueue([c])
    runner.run_due()
    r = ledger.get("c1")
    assert (r.status, r.outcome, r.voicemails) == ("pending", "voicemail", 1)
    assert r.next_attempt_at - START >= timedelta(hours=3)  # voicemail waits longer than no answer
    drain(runner, ledger, clock)
    assert ledger.get("c1").outcome == "booked"


def test_two_voicemails_stop_the_retries():
    c = contact()
    vm = {"status": "completed", "duration": 12, "agent_text": VOICEMAIL_MARKER}
    runner, ledger, dialer, clock = build({c.phone: [vm, vm, vm]})
    runner.enqueue([c])
    drain(runner, ledger, clock)
    r = ledger.get("c1")
    assert (r.status, r.attempts, r.voicemails) == ("done", 2, 2)
    assert "voicemail cap" in r.reason
    assert len(dialer.placed) == 2


def test_attempt_cap_is_respected_for_endless_failures():
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"status": "failed"}] * 20})
    runner.enqueue([c])
    drain(runner, ledger, clock)
    assert ledger.get("c1").attempts == Policy().max_attempts
    assert len(dialer.placed) == Policy().max_attempts


def test_transient_start_error_is_retried_and_rejection_is_final():
    a, b = contact(1), contact(2)
    runner, ledger, dialer, clock = build({
        a.phone: [{"start_error": "transient"}, {"status": "completed", "duration": 30,
                                                "metrics": {"booking_status": "booked"}}],
        b.phone: [{"start_error": "rejected"}, {"status": "completed", "duration": 30,
                                               "metrics": {"booking_status": "booked"}}],
    })
    runner.enqueue([a, b])
    drain(runner, ledger, clock)
    assert (ledger.get("c1").outcome, ledger.get("c1").attempts) == ("booked", 2)
    assert (ledger.get("c2").outcome, ledger.get("c2").attempts) == ("start_rejected", 1)


@pytest.mark.parametrize("verdict", ["do_not_call", "wrong_number"])
def test_do_not_call_and_wrong_number_suppress_the_number(verdict):
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"status": "completed", "duration": 20,
                                                      "metrics": {"booking_status": verdict}}]})
    runner.enqueue([c])
    drain(runner, ledger, clock)
    assert c.phone in ledger.suppressed_numbers()
    # A new request for the same number is never dialled.
    again = Contact("c9", "Someone Else", c.phone, c.timezone, "checkup", "demo")
    runner.enqueue([again])
    runner.dialer = ScriptedDialer({c.phone: [{"status": "completed"}]})
    drain(runner, ledger, clock)
    assert ledger.get("c9").outcome == "do_not_call"
    assert runner.dialer.placed == []


def test_a_real_conversation_without_a_verdict_is_never_redialled():
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"status": "completed", "duration": 120}] * 3})
    runner.enqueue([c])
    drain(runner, ledger, clock)
    assert (ledger.get("c1").outcome, ledger.get("c1").attempts) == ("needs_review", 1)


def test_first_call_waits_for_the_calling_window():
    c = contact()
    night = Clock(datetime(2026, 12, 1, 8, 0, tzinfo=timezone.utc))  # 03:00 in New York
    runner, ledger, dialer, clock = build({c.phone: [{"status": "no_answer"}]}, clock=night)
    runner.enqueue([c])
    assert runner.run_due() == 0
    assert dialer.placed == []
    assert ledger.get("c1").next_attempt_at == datetime(2026, 12, 1, 14, 0, tzinfo=timezone.utc)


def test_enqueue_is_idempotent():
    runner, ledger, dialer, clock = build({})
    assert runner.enqueue([contact()]) == 1
    assert runner.enqueue([contact()]) == 0
    assert len(ledger.all()) == 1


def test_claim_cannot_double_dial():
    runner, ledger, dialer, clock = build({})
    runner.enqueue([contact()])
    assert ledger.claim("c1", clock()) == 1
    assert ledger.claim("c1", clock()) is None


def test_crash_before_call_id_is_flagged_not_redialled():
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"status": "completed"}]})
    runner.enqueue([c])
    assert ledger.claim("c1", clock()) == 1  # simulate a crash right after the claim
    assert runner.recover() == 1
    r = ledger.get("c1")
    assert (r.status, r.outcome) == ("done", "needs_review")
    runner.run_due()
    assert dialer.placed == []


def test_crash_after_call_id_resumes_by_reading_the_call():
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"status": "completed", "duration": 30,
                                                      "metrics": {"booking_status": "booked"}}]})
    runner.enqueue([c])
    n = ledger.claim("c1", clock())
    call_id = dialer.place(c, n)
    ledger.set_call_id("c1", n, call_id)  # crashed before the result was saved
    assert runner.recover() == 1
    assert ledger.get("c1").outcome == "booked"
    assert len(dialer.placed) == 1


# ---- live guards ---------------------------------------------------------


def test_live_mode_blocks_numbers_outside_allowed_prefixes():
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"status": "no_answer"}]}, live=LiveLimits(("+91",), 5))
    runner.enqueue([c])
    drain(runner, ledger, clock)
    assert ledger.get("c1").outcome == "blocked"
    assert dialer.placed == []


def test_live_mode_per_run_call_cap():
    cs = [contact(n) for n in range(1, 5)]
    runner, ledger, dialer, clock = build(
        {c.phone: [{"status": "completed", "duration": 30, "metrics": {"booking_status": "booked"}}] for c in cs},
        live=LiveLimits(("+1",), 2),
    )
    runner.enqueue(cs)
    runner.run_due()
    assert len(dialer.placed) == 2
    assert sum(1 for r in ledger.all() if r.status == "pending") == 2


# ---- fixtures and docs stay in sync ----------------------------------------


def test_simulate_fixture_outcomes(capsys):
    assert booking_retry.main(["simulate"]) == 0
    out = capsys.readouterr().out
    assert "totals: booked=2, declined=1, do_not_call=1, no_answer=1, voicemail=1" in out


def test_agent_voicemail_message_contains_the_marker_the_classifier_looks_for():
    cfg = json.loads((ROOT / "agent" / "agent-config.example.json").read_text())
    assert cfg["voiceMailDetectionConfig"]["enabled"] is True
    assert _squash(VOICEMAIL_MARKER) in _squash(cfg["voiceMailDetectionConfig"]["endText"])


def test_agent_config_declares_every_status_the_policy_understands():
    from policy import _BOOKING_STATUS

    cfg = json.loads((ROOT / "agent" / "agent-config.example.json").read_text())
    metric = next(m for m in cfg["postCallAnalytics"]["dispositionMetrics"] if m["identifier"] == "booking_status")
    assert {c.replace("_", "") for c in metric["choices"]} == set(_BOOKING_STATUS)


def test_prompt_and_greeting_disclose_ai_in_the_first_line():
    cfg = json.loads((ROOT / "agent" / "agent-config.example.json").read_text())
    assert "automated assistant" in cfg["firstMessage"].lower()
    prompt = (ROOT / "agent" / "prompt.md").read_text()
    assert "you are an ai" in prompt.lower().split("\n")[0]
    assert "automated assistant" in prompt.split("Opening line")[1].split("Goal")[0].lower()


def test_uncertain_start_is_handed_to_a_human_and_never_redialled():
    c = contact()
    runner, ledger, dialer, clock = build({c.phone: [{"start_error": "uncertain"},
                                                     {"status": "completed", "duration": 30,
                                                      "metrics": {"booking_status": "booked"}}]})
    runner.enqueue([c])
    drain(runner, ledger, clock)
    r = ledger.get("c1")
    assert (r.outcome, r.attempts, r.status) == ("needs_review", 1, "done")
    assert len(dialer.placed) == 1
