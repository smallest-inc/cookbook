import random
from datetime import datetime, timedelta, timezone

import pytest

from policy import (
    RETRYABLE,
    VOICEMAIL_MARKER,
    CallResult,
    Outcome,
    Policy,
    classify,
    decide,
    next_window_open,
)

UTC = timezone.utc
P = Policy()


def result(**kw):
    kw.setdefault("status", "completed")
    return CallResult(**kw)


# ---- classify -------------------------------------------------------------


@pytest.mark.parametrize(
    "status,expected",
    [
        ("no_answer", Outcome.NO_ANSWER),
        ("failed", Outcome.FAILED),
        ("cancelled", Outcome.CANCELLED),
        ("aborted", Outcome.CANCELLED),
        ("blocked", Outcome.BLOCKED),
        ("in_progress", Outcome.NEEDS_REVIEW),
        ("timeout", Outcome.NEEDS_REVIEW),
    ],
)
def test_status_mapping(status, expected):
    assert classify(result(status=status)) is expected


@pytest.mark.parametrize(
    "value,expected",
    [
        ("booked", Outcome.BOOKED),
        ("Booked", Outcome.BOOKED),
        ("callback_requested", Outcome.CALLBACK_REQUESTED),
        ("Callback Requested", Outcome.CALLBACK_REQUESTED),
        ("do_not_call", Outcome.DO_NOT_CALL),
        ("wrong-number", Outcome.WRONG_NUMBER),
        ("declined", Outcome.DECLINED),
        ("voicemail", Outcome.VOICEMAIL),
        ("no_conversation", Outcome.SHORT_CALL),
    ],
)
def test_agent_verdict_wins(value, expected):
    assert classify(result(duration_secs=60, metrics={"booking_status": value})) is expected


def test_verdict_beats_voicemail_marker():
    r = result(duration_secs=60, metrics={"booking_status": "booked"}, agent_text=VOICEMAIL_MARKER)
    assert classify(r) is Outcome.BOOKED


def test_voicemail_marker_is_found_through_punctuation_and_case():
    text = "Hello. I'm sorry I missed you. I will try you again later, or call us back!"
    assert classify(result(duration_secs=14, agent_text=text)) is Outcome.VOICEMAIL


def test_short_call_hangup_by_person_is_not_retried():
    r = result(duration_secs=3, disconnect_reason="user_hangup")
    assert classify(r) is Outcome.HUNG_UP
    assert Outcome.HUNG_UP not in RETRYABLE


def test_short_call_other_reason_is_retryable():
    assert classify(result(duration_secs=3, disconnect_reason="agent_hangup")) is Outcome.SHORT_CALL


def test_long_call_without_verdict_goes_to_a_human_not_a_redial():
    out = classify(result(duration_secs=90))
    assert out is Outcome.NEEDS_REVIEW
    assert out not in RETRYABLE


def test_unknown_verdict_value_falls_through():
    assert classify(result(duration_secs=90, metrics={"booking_status": "mystery"})) is Outcome.NEEDS_REVIEW


# ---- decide ---------------------------------------------------------------

NOON_NY = datetime(2026, 12, 1, 17, 0, tzinfo=UTC)  # 12:00 in New York


def go(outcome, attempts=1, voicemails=0, now=NOON_NY, tz="America/New_York", policy=P, first=None):
    return decide(
        outcome,
        attempts_made=attempts,
        voicemails_so_far=voicemails,
        first_attempt_at=first or now,
        now=now,
        tz_name=tz,
        policy=policy,
        rng=random.Random(1),
    )


def test_final_outcomes_never_retry():
    for o in Outcome:
        if o not in RETRYABLE:
            assert go(o).retry is False


def test_no_answer_uses_the_delay_table_and_repeats_the_last_value():
    no_jitter = Policy(jitter=0.0)
    gaps = [go(Outcome.NO_ANSWER, attempts=n, policy=no_jitter, now=NOON_NY, first=NOON_NY).next_at - NOON_NY
            for n in (1, 2, 3)]
    assert gaps == [timedelta(minutes=15), timedelta(minutes=60), timedelta(minutes=180)]


def test_attempt_cap():
    d = go(Outcome.NO_ANSWER, attempts=P.max_attempts)
    assert d.retry is False and "cap" in d.reason


def test_voicemail_waits_longer_and_stops_sooner():
    no_jitter = Policy(jitter=0.0)
    first = go(Outcome.VOICEMAIL, attempts=1, voicemails=1, policy=no_jitter)
    assert first.next_at - NOON_NY == timedelta(minutes=240)
    second = go(Outcome.VOICEMAIL, attempts=2, voicemails=2, policy=no_jitter)
    assert second.retry is False and "voicemail cap" in second.reason


def test_failures_back_off_exponentially_to_a_cap():
    no_jitter = Policy(jitter=0.0, max_attempts=10)
    mins = [(go(Outcome.FAILED, attempts=n, policy=no_jitter).next_at - NOON_NY).total_seconds() / 60
            for n in range(1, 8)]
    assert mins == [2, 4, 8, 16, 30, 30, 30]


def test_jitter_stays_inside_its_band():
    for seed in range(50):
        d = decide(Outcome.NO_ANSWER, attempts_made=1, voicemails_so_far=0, first_attempt_at=NOON_NY,
                   now=NOON_NY, tz_name="America/New_York", policy=P, rng=random.Random(seed))
        minutes = (d.next_at - NOON_NY).total_seconds() / 60
        assert 13.5 <= minutes <= 16.5


def test_retry_is_pushed_into_the_calling_window():
    # 17:50 in New York plus 15 minutes is 18:05, after the window closes at 18:00.
    late = datetime(2026, 12, 1, 22, 50, tzinfo=UTC)
    d = go(Outcome.NO_ANSWER, now=late, policy=Policy(jitter=0.0))
    local = d.next_at.astimezone(__import__("zoneinfo").ZoneInfo("America/New_York"))
    assert (local.hour, local.minute, local.day) == (9, 0, 2)


def test_deadline_stops_retries():
    first = NOON_NY - timedelta(hours=71, minutes=59)
    d = go(Outcome.NO_ANSWER, attempts=2, first=first, policy=Policy(jitter=0.0))
    assert d.retry is False and "deadline" in d.reason


def test_window_skips_sunday():
    sunday_noon = datetime(2026, 12, 6, 17, 0, tzinfo=UTC)  # a Sunday
    assert sunday_noon.weekday() == 6
    opened = next_window_open(sunday_noon, "America/New_York", P)
    assert opened.astimezone(__import__("zoneinfo").ZoneInfo("America/New_York")).weekday() == 0


def test_window_uses_the_contacts_timezone():
    moment = datetime(2026, 12, 1, 3, 30, tzinfo=UTC)  # 09:00 in Kolkata
    assert next_window_open(moment, "Asia/Kolkata", P) == moment


def test_invalid_policies_are_rejected():
    for bad in ({"max_attempts": 0}, {"max_attempts": 11}, {"jitter": 1.0},
                {"window_start_hour": 18, "window_end_hour": 9}, {"no_answer_delays_min": ()},
                {"voicemail_delays_min": (0,)}):
        with pytest.raises(ValueError):
            Policy(**bad)
