"""Dialers: the only place that can place a call.

`Dialer` is a two-method protocol. `AtomsDialer` talks to the Atoms API.
`ScriptedDialer` replays outcomes from a fixture file and cannot reach any
network, so tests and the simulator never ring a phone.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable, Mapping, Optional, Protocol

from guard import Contact, check_hex_id, mask
from policy import TERMINAL_STATUSES, CallResult


class StartRejected(Exception):
    """The platform refused the call for good (bad number, archived agent)."""


class StartTransient(Exception):
    """The call was definitely not started and may be tried again (429, 502-504, no connection)."""


class StartUncertain(Exception):
    """The request may or may not have reached the platform (timeout, HTTP 500).

    Redialling could ring the same person twice, so the runner hands these to a human.
    """


class Dialer(Protocol):
    def place(self, contact: Contact, attempt_no: int) -> str:
        """Start a call and return its call id."""

    def wait(self, call_id: str) -> CallResult:
        """Block until the call is over and return what happened."""


# ---------------------------------------------------------------------------
# Scripted dialer (tests, simulator, demos)
# ---------------------------------------------------------------------------


class ScriptedDialer:
    """Replays a list of results per phone number. Never touches the network.

    Scenario file format:
        {"+12025550101": [{"status": "no_answer"}, {"status": "completed", ...}]}
    A step of {"start_error": "transient"}, "rejected" or "uncertain" makes
    `place` raise instead of returning a call id.
    """

    def __init__(self, scenarios: Mapping[str, list[Mapping[str, Any]]]) -> None:
        self._steps = {phone: list(steps) for phone, steps in scenarios.items()}
        self._by_call: dict[str, CallResult] = {}
        self._counter = 0
        self.placed: list[tuple[str, int]] = []  # (contact id, attempt_no), for assertions

    @classmethod
    def from_file(cls, path: Path) -> "ScriptedDialer":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("scenario file must be a JSON object")
        return cls(data)

    def place(self, contact: Contact, attempt_no: int) -> str:
        steps = self._steps.get(contact.phone)
        if not steps:
            raise StartRejected("no scripted outcome left for this number")
        step = steps.pop(0)
        self.placed.append((contact.id, attempt_no))
        error = step.get("start_error")
        if error == "transient":
            raise StartTransient("scripted transient start error")
        if error == "rejected":
            raise StartRejected("scripted rejection")
        if error == "uncertain":
            raise StartUncertain("scripted uncertain start")
        self._counter += 1
        call_id = f"MOCK-{self._counter:06d}"
        self._by_call[call_id] = CallResult(
            status=str(step.get("status", "completed")),
            duration_secs=float(step.get("duration", 0)),
            disconnect_reason=step.get("disconnect_reason"),
            metrics=dict(step.get("metrics", {})),
            agent_text=str(step.get("agent_text", "")),
            failure_reason=step.get("failure_reason"),
        )
        return call_id

    def wait(self, call_id: str) -> CallResult:
        return self._by_call[call_id]


# ---------------------------------------------------------------------------
# Atoms dialer (live)
# ---------------------------------------------------------------------------


class AtomsDialer:
    """Places calls with `client.atoms.calls.start_outbound_call` and polls the call log.

    `client` is a `smallestai.SmallestAI`. It is passed in, so the API key never
    passes through this class. Build it with `SmallestAI()`, which reads
    SMALLEST_API_KEY from the environment.
    """

    def __init__(
        self,
        client: Any,
        agent_id: str,
        *,
        from_product_id: Optional[str] = None,
        test_call: bool = False,
        poll_secs: float = 5.0,
        call_timeout_secs: float = 20 * 60,
        analytics_wait_secs: float = 90.0,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self.client = client
        self.agent_id = check_hex_id(agent_id, "ATOMS_AGENT_ID")
        self.from_product_id = check_hex_id(from_product_id, "ATOMS_FROM_PRODUCT_ID") if from_product_id else None
        self.test_call = test_call
        self.poll_secs = max(poll_secs, 1.0)
        self.call_timeout_secs = call_timeout_secs
        self.analytics_wait_secs = analytics_wait_secs
        self._sleep = sleep
        self._monotonic = monotonic

    def place(self, contact: Contact, attempt_no: int) -> str:
        kwargs: dict[str, Any] = {
            "agent_id": self.agent_id,
            "phone_number": contact.phone,
            # Variables are strings or numbers only. Name and service were validated in guard.py.
            "variables": {
                "customer_name": contact.name,
                "service": contact.service.replace("_", " "),
                "attempt": attempt_no,
            },
        }
        if self.from_product_id:
            kwargs["from_product_id"] = self.from_product_id
        if self.test_call:
            kwargs["test_call"] = "true"
        try:
            # max_retries=0: the SDK must not resend a call request by itself. Retries
            # are decided by the policy and recorded in the ledger, never hidden.
            response = self.client.atoms.calls.start_outbound_call(
                **kwargs, request_options={"max_retries": 0, "timeout_in_seconds": 30}
            )
        except Exception as exc:  # classify by HTTP status, never print the body
            raise _classify_start_error(exc) from None
        call_id = getattr(getattr(response, "data", None), "conversation_id", None)
        if not isinstance(call_id, str) or not call_id:
            raise StartUncertain("start_outbound_call returned no call id")
        return call_id

    def wait(self, call_id: str) -> CallResult:
        deadline = self._monotonic() + self.call_timeout_secs
        data: Any = None
        while self._monotonic() < deadline:
            data = self._get(call_id)
            if data is not None and str(getattr(data, "status", "")).lower() in TERMINAL_STATUSES:
                break
            self._sleep(self.poll_secs)
        else:
            return CallResult(status="timeout", failure_reason="gave up waiting for the call to end")

        # Post-call analytics land a little after the call ends. Give them a moment.
        analytics_deadline = self._monotonic() + self.analytics_wait_secs
        while (
            str(getattr(data, "status", "")).lower() == "completed"
            and not self._metrics(data)
            and self._monotonic() < analytics_deadline
        ):
            self._sleep(self.poll_secs)
            fresh = self._get(call_id)
            data = fresh if fresh is not None else data
        return self._to_result(data)

    # ---- helpers ----------------------------------------------------------

    def _get(self, call_id: str) -> Any:
        try:
            return self.client.atoms.calls.get(id=call_id).data
        except Exception:
            return None  # a failed poll is not a failed call, try again

    @staticmethod
    def _metrics(data: Any) -> dict[str, str]:
        analytics = getattr(data, "post_call_analytics", None)
        items = getattr(analytics, "disposition_metrics", None) or []
        out: dict[str, str] = {}
        for item in items:
            ident = getattr(item, "identifier", None)
            value = getattr(item, "value", None)
            if ident and value is not None:
                out[str(ident)] = str(value)
        return out

    def _to_result(self, data: Any) -> CallResult:
        extra = getattr(data, "model_extra", None) or {}
        reason = (
            extra.get("disconnectionReason")
            or extra.get("disconnection_reason")
            or getattr(data, "disconnection_reason", None)
        )
        agent_text = " ".join(
            str(getattr(turn, "content", "") or "")
            for turn in (getattr(data, "transcript", None) or [])
            if str(getattr(turn, "role", "")) == "agent"
        )
        return CallResult(
            status=str(getattr(data, "status", "") or ""),
            duration_secs=float(getattr(data, "duration", 0) or 0),
            disconnect_reason=str(reason) if reason else None,
            metrics=self._metrics(data),
            agent_text=agent_text,
            failure_reason=getattr(data, "call_failure_reason", None),
        )


def _classify_start_error(exc: Exception) -> Exception:
    """Sort a failed start into rejected, transient, or uncertain. Never echoes the response body."""
    import httpx

    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        if status in (429, 502, 503, 504):
            return StartTransient(f"platform busy (HTTP {status})")
        if 400 <= status < 500 and status not in (408, 409, 425):
            return StartRejected(f"platform rejected the call (HTTP {status})")
        return StartUncertain(f"unclear whether the call started (HTTP {status})")
    if isinstance(exc, httpx.ConnectError):
        return StartTransient("could not connect to the platform")
    return StartUncertain(f"unclear whether the call started ({type(exc).__name__})")


def describe(contact: Contact, call_id: str) -> str:
    """A log-safe label for a call: masked number, never the name."""
    return f"{call_id} -> {mask(contact.phone)}"
