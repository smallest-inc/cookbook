"""Retry policy for a booking agent: classify a finished call, then decide
whether to dial again and when.

This file is pure logic. It makes no network calls and reads no environment
variables, so every rule can be tested with plain asserts.

The one idea to take away: only retry when no conversation happened. A call
that went unanswered, failed, or reached a voicemail greeting is retried. A
call where a person talked to the agent is never redialled automatically,
whatever the outcome was.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Mapping, Optional
from zoneinfo import ZoneInfo


class Outcome(str, Enum):
    # Terminal: a person spoke to the agent.
    BOOKED = "booked"
    DECLINED = "declined"
    CALLBACK_REQUESTED = "callback_requested"
    DO_NOT_CALL = "do_not_call"
    WRONG_NUMBER = "wrong_number"
    HUNG_UP = "hung_up"
    NEEDS_REVIEW = "needs_review"
    # Terminal: the call was stopped on purpose or blocked by the platform.
    CANCELLED = "cancelled"
    BLOCKED = "blocked"
    # Retryable: nobody had a conversation with the agent.
    NO_ANSWER = "no_answer"
    VOICEMAIL = "voicemail"
    FAILED = "failed"
    SHORT_CALL = "short_call"
    # Retryable: the call could not even be started (network, 429, 5xx).
    START_ERROR = "start_error"
    # Terminal: the platform rejected the request (bad number, bad agent).
    START_REJECTED = "start_rejected"


RETRYABLE = frozenset(
    {
        Outcome.NO_ANSWER,
        Outcome.VOICEMAIL,
        Outcome.FAILED,
        Outcome.SHORT_CALL,
        Outcome.START_ERROR,
    }
)

# Outcomes after which the number must never be dialled again by this tool.
SUPPRESS = frozenset({Outcome.DO_NOT_CALL, Outcome.WRONG_NUMBER})

# Values the agent's `booking_status` disposition metric may take. Matching is
# case-insensitive and ignores spaces, dashes and underscores.
_BOOKING_STATUS = {
    "booked": Outcome.BOOKED,
    "declined": Outcome.DECLINED,
    "callbackrequested": Outcome.CALLBACK_REQUESTED,
    "donotcall": Outcome.DO_NOT_CALL,
    "wrongnumber": Outcome.WRONG_NUMBER,
    "voicemail": Outcome.VOICEMAIL,
    "noconversation": Outcome.SHORT_CALL,
}

# Statuses from the Atoms call log that mean the call is over.
TERMINAL_STATUSES = frozenset(
    {"completed", "failed", "no_answer", "cancelled", "aborted", "blocked"}
)

# Marker the agent says when its voicemail detection fires. It must appear in
# the `endText` of agent/agent-config.example.json (a test checks they match).
VOICEMAIL_MARKER = "i will try you again later"


def _norm(value: Any) -> str:
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def _squash(text: str) -> str:
    """Lowercase, drop punctuation, collapse spaces. Makes phrase matching stable."""
    return " ".join("".join(ch if ch.isalnum() or ch == " " else "" for ch in text.lower()).split())


@dataclass(frozen=True)
class CallResult:
    """What we know about one finished (or never-started) call attempt."""

    status: str
    duration_secs: float = 0.0
    disconnect_reason: Optional[str] = None
    # Disposition metrics from post-call analytics, keyed by identifier.
    metrics: Mapping[str, str] = field(default_factory=dict)
    # Everything the agent said, joined. Used only to spot the voicemail marker.
    agent_text: str = ""
    failure_reason: Optional[str] = None


@dataclass(frozen=True)
class Policy:
    # Total dial attempts including the first. 4 means the first call plus 3 retries.
    max_attempts: int = 4
    # Wait before retry n (1-based) after no answer. Last value repeats.
    no_answer_delays_min: tuple[int, ...] = (15, 60, 180)
    # A voicemail was left, so wait longer and stop sooner.
    voicemail_delays_min: tuple[int, ...] = (240, 1440)
    max_voicemails: int = 2
    # Failures are usually transient, so retry quickly with exponential backoff.
    failure_base_min: int = 2
    failure_cap_min: int = 30
    # Give up on a booking request this long after the first attempt.
    give_up_after_hours: int = 72
    # +/- fraction applied to each delay so retries do not line up.
    jitter: float = 0.1
    # Completed calls shorter than this with no analytics are treated as SHORT_CALL.
    short_call_secs: float = 8.0
    # Local calling window for the contact. Hours are 24h, weekdays Mon=0.
    window_start_hour: int = 9
    window_end_hour: int = 18
    window_weekdays: tuple[int, ...] = (0, 1, 2, 3, 4, 5)
    # Name of the disposition metric the agent fills in.
    status_metric: str = "booking_status"

    def __post_init__(self) -> None:
        if not 1 <= self.max_attempts <= 10:
            raise ValueError("max_attempts must be between 1 and 10")
        if not 0 <= self.jitter < 1:
            raise ValueError("jitter must be in [0, 1)")
        if not (0 <= self.window_start_hour < self.window_end_hour <= 24):
            raise ValueError("calling window hours are invalid")
        if not self.no_answer_delays_min or not self.voicemail_delays_min:
            raise ValueError("delay lists must not be empty")
        if min(self.no_answer_delays_min + self.voicemail_delays_min) < 1:
            raise ValueError("delays must be at least 1 minute")


def classify(result: CallResult, policy: Policy = Policy()) -> Outcome:
    """Turn a call result into one Outcome. Order matters, first match wins."""
    status = (result.status or "").lower()

    if status == "no_answer":
        return Outcome.NO_ANSWER
    if status == "failed":
        return Outcome.FAILED
    if status in ("cancelled", "aborted"):
        return Outcome.CANCELLED
    if status == "blocked":
        return Outcome.BLOCKED
    if status != "completed":
        # Not a terminal status. The dialer should not hand these to us.
        return Outcome.NEEDS_REVIEW

    # 1. The agent's own verdict, from the post-call disposition metric.
    verdict = _BOOKING_STATUS.get(_norm(result.metrics.get(policy.status_metric, "")))
    if verdict is not None:
        return verdict

    # 2. Voicemail detection fired: the agent said the marker phrase.
    if _squash(VOICEMAIL_MARKER) in _squash(result.agent_text):
        return Outcome.VOICEMAIL

    # 3. A very short call with no verdict. A person who hung up straight away
    #    asked to be left alone, so do not call back. Anything else is a glitch.
    if result.duration_secs < policy.short_call_secs:
        if (result.disconnect_reason or "").lower() == "user_hangup":
            return Outcome.HUNG_UP
        return Outcome.SHORT_CALL

    # 4. A real conversation with no verdict. Never redial, ask a human.
    return Outcome.NEEDS_REVIEW


@dataclass(frozen=True)
class Decision:
    retry: bool
    reason: str
    next_at: Optional[datetime] = None  # timezone-aware UTC


def _delay_minutes(outcome: Outcome, policy: Policy, nth: int) -> int:
    """Base delay before the nth retry (nth starts at 1) for a given outcome."""
    if outcome in (Outcome.FAILED, Outcome.START_ERROR):
        return min(policy.failure_base_min * 2 ** (nth - 1), policy.failure_cap_min)
    table = policy.voicemail_delays_min if outcome is Outcome.VOICEMAIL else policy.no_answer_delays_min
    return table[min(nth - 1, len(table) - 1)]


def next_window_open(moment: datetime, tz_name: str, policy: Policy) -> datetime:
    """Return `moment`, or the next time the contact's calling window is open."""
    tz = ZoneInfo(tz_name)
    local = moment.astimezone(tz)
    for _ in range(9):  # at most a week plus one day of looking
        if local.weekday() in policy.window_weekdays:
            opens = local.replace(hour=policy.window_start_hour, minute=0, second=0, microsecond=0)
            closes = local.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
                hours=policy.window_end_hour
            )
            if local < opens:
                return opens.astimezone(moment.tzinfo)
            if local < closes:
                return local.astimezone(moment.tzinfo)
        local = (local + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    raise ValueError("calling window never opens, check window_weekdays")


def decide(
    outcome: Outcome,
    *,
    attempts_made: int,
    voicemails_so_far: int,
    first_attempt_at: datetime,
    now: datetime,
    tz_name: str,
    policy: Policy = Policy(),
    rng: Optional[random.Random] = None,
) -> Decision:
    """Decide whether to dial again after `outcome`.

    `attempts_made` counts the attempt that just ended. `voicemails_so_far`
    includes it when the outcome is VOICEMAIL.
    """
    if outcome not in RETRYABLE:
        return Decision(False, f"{outcome.value} is final")
    if attempts_made >= policy.max_attempts:
        return Decision(False, f"attempt cap reached ({policy.max_attempts})")
    if outcome is Outcome.VOICEMAIL and voicemails_so_far >= policy.max_voicemails:
        return Decision(False, f"voicemail cap reached ({policy.max_voicemails})")

    # jitter for retry timing, not cryptography
    rng = rng or random.Random()  # nosec B311
    base = _delay_minutes(outcome, policy, attempts_made)
    factor = 1 + rng.uniform(-policy.jitter, policy.jitter)
    candidate = now + timedelta(minutes=base * factor)
    candidate = next_window_open(candidate, tz_name, policy)

    deadline = first_attempt_at + timedelta(hours=policy.give_up_after_hours)
    if candidate > deadline:
        return Decision(False, f"next try would pass the {policy.give_up_after_hours}h deadline")
    return Decision(True, f"retry after {outcome.value}", candidate)
