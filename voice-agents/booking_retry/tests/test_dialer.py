"""AtomsDialer against the real SDK, with the HTTP layer replaced by an in-memory transport.

The SDK builds and parses real requests and responses. Only the socket is fake,
so no call is ever placed.
"""

import json
from datetime import datetime, timezone

import httpx
import pytest

from dialer import AtomsDialer, StartRejected, StartTransient, StartUncertain
from guard import Contact, InputError
from policy import Outcome, classify

AGENT = "64b7f0c2a1b2c3d4e5f60718"
CALL = "CALL-1234567890123-abcdef"
C = Contact("c1", "Test Person", "+12025550101", "America/New_York", "follow_up", "demo")


def client_for(handler):
    from smallestai import SmallestAI

    return SmallestAI(api_key="test-key-not-real", httpx_client=httpx.Client(transport=httpx.MockTransport(handler)))


def call_log(status, **extra):
    data = {"callId": CALL, "status": status, "duration": 0, **extra}
    return httpx.Response(200, json={"status": True, "data": data})


class FakeTime:
    def __init__(self):
        self.t = 0.0

    def monotonic(self):
        return self.t

    def sleep(self, secs):
        self.t += secs


def dialer(handler, **kw):
    ft = FakeTime()
    d = AtomsDialer(client_for(handler), AGENT, sleep=ft.sleep, monotonic=ft.monotonic, **kw)
    return d, ft


def test_place_sends_validated_variables_and_returns_the_call_id():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content)
        seen["test"] = request.headers.get("x-test-call")
        return httpx.Response(200, json={"status": True, "data": {"conversationId": CALL}})

    d, _ = dialer(handler, test_call=True, from_product_id="64b7f0c2a1b2c3d4e5f60719")
    assert d.place(C, 2) == CALL
    assert seen["path"].endswith("/conversation/outbound")
    assert seen["test"] == "true"
    assert seen["body"]["agentId"] == AGENT
    assert seen["body"]["phoneNumber"] == "+12025550101"
    assert seen["body"]["fromProductId"] == "64b7f0c2a1b2c3d4e5f60719"
    assert seen["body"]["variables"] == {"customer_name": "Test Person", "service": "follow up", "attempt": 2}


@pytest.mark.parametrize("status,exc", [(400, StartRejected), (403, StartRejected), (404, StartRejected),
                                         (429, StartTransient), (502, StartTransient), (503, StartTransient),
                                         (500, StartUncertain)])
def test_start_errors_are_split_into_rejected_transient_and_uncertain(status, exc):
    hits = {"n": 0}

    def handler(request):
        hits["n"] += 1
        return httpx.Response(status, json={"status": False, "errors": ["secret-ish detail"]})

    d, _ = dialer(handler)
    with pytest.raises(exc) as info:
        d.place(C, 1)
    assert type(info.value) is exc
    assert "secret-ish" not in str(info.value)  # response bodies are never echoed
    assert hits["n"] == 1  # the SDK did not retry behind our back, so no hidden double dial


def test_no_connection_is_transient_but_a_timeout_is_uncertain():
    def refuse(request):
        raise httpx.ConnectError("boom")

    def slow(request):
        raise httpx.ReadTimeout("boom")

    d, _ = dialer(refuse)
    with pytest.raises(StartTransient):
        d.place(C, 1)
    d, _ = dialer(slow)
    with pytest.raises(StartUncertain):
        d.place(C, 1)


def test_missing_call_id_is_uncertain():
    d, _ = dialer(lambda r: httpx.Response(200, json={"status": True, "data": {}}))
    with pytest.raises(StartUncertain):
        d.place(C, 1)


def test_ids_are_validated_before_any_request():
    from smallestai import SmallestAI

    with pytest.raises(InputError):
        AtomsDialer(SmallestAI(api_key="x"), "not-a-valid-id")
    with pytest.raises(InputError):
        AtomsDialer(SmallestAI(api_key="x"), AGENT, from_product_id="nope")


def test_wait_polls_until_the_call_ends_then_returns_the_result():
    polls = iter(["in_progress", "active", "completed"])

    def handler(request):
        return call_log(next(polls), disconnectionReason="agent_hangup", duration=61,
                        postCallAnalytics={"dispositionMetrics": [{"identifier": "booking_status", "value": "booked"}]},
                        transcript=[{"role": "agent", "content": "Hello"}, {"role": "user", "content": "Yes"}])

    d, _ = dialer(handler)
    r = d.wait(CALL)
    assert (r.status, r.duration_secs, r.disconnect_reason) == ("completed", 61.0, "agent_hangup")
    assert r.metrics == {"booking_status": "booked"}
    assert r.agent_text == "Hello"  # only the agent's turns
    assert classify(r) is Outcome.BOOKED


def test_wait_gives_post_call_analytics_time_to_arrive():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] < 4:
            return call_log("completed", duration=40)
        return call_log("completed", duration=40, postCallAnalytics={
            "dispositionMetrics": [{"identifier": "booking_status", "value": "declined"}]})

    d, _ = dialer(handler)
    assert classify(d.wait(CALL)) is Outcome.DECLINED


def test_no_answer_returns_without_waiting_for_analytics():
    n = {"calls": 0}

    def handler(request):
        n["calls"] += 1
        return call_log("no_answer")

    d, ft = dialer(handler)
    assert classify(d.wait(CALL)) is Outcome.NO_ANSWER
    assert n["calls"] == 1 and ft.t == 0


def test_a_failed_poll_is_not_a_failed_call():
    seq = iter([httpx.Response(502), call_log("failed", callFailureReason="carrier")])
    d, _ = dialer(lambda r: next(seq))
    r = d.wait(CALL)
    assert classify(r) is Outcome.FAILED and r.failure_reason == "carrier"


def test_timeout_is_needs_review_so_a_live_call_is_never_redialled():
    d, _ = dialer(lambda r: call_log("in_progress"), call_timeout_secs=30)
    assert classify(d.wait(CALL)) is Outcome.NEEDS_REVIEW


def test_atoms_dialer_end_to_end_with_the_runner():
    import random

    from ledger import Ledger
    from runner import LiveLimits, Runner

    state_of_call = {"n": 0}

    def handler(request):
        if request.url.path.endswith("/conversation/outbound"):
            state_of_call["n"] += 1
            return httpx.Response(200, json={"status": True, "data": {"conversationId": f"CALL-{state_of_call['n']:013d}-aaaaaa"}})
        if state_of_call["n"] == 1:
            return call_log("no_answer")
        return call_log("completed", duration=50, postCallAnalytics={
            "dispositionMetrics": [{"identifier": "booking_status", "value": "booked"}]})

    clock = {"t": datetime(2026, 12, 1, 14, 0, tzinfo=timezone.utc)}
    d, _ = dialer(handler)
    ledger = Ledger()
    runner = Runner(ledger, d, now=lambda: clock["t"], rng=random.Random(1), live=LiveLimits(("+1",), 5))
    runner.enqueue([C])
    runner.run_due()
    assert ledger.get("c1").outcome == "no_answer"
    clock["t"] = ledger.next_due_at()
    runner.run_due()
    assert (ledger.get("c1").outcome, ledger.get("c1").attempts) == ("booked", 2)
