"""The retry loop. Takes due requests from the ledger, dials, records, reschedules."""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Optional, Sequence

from dialer import Dialer, StartRejected, StartTransient, StartUncertain, describe
from guard import Contact, InputError, live_dial_check, mask
from ledger import Ledger, Request
from policy import SUPPRESS, CallResult, Outcome, Policy, classify, decide, next_window_open

log = logging.getLogger("booking_retry")


@dataclass
class LiveLimits:
    """Extra brakes that only apply when the dialer is real."""

    allowed_prefixes: Sequence[str] = ()
    max_calls_per_run: int = 5


@dataclass
class Runner:
    ledger: Ledger
    dialer: Dialer
    policy: Policy = field(default_factory=Policy)
    now: Callable[[], datetime] = lambda: datetime.now().astimezone()
    # retry jitter
    rng: random.Random = field(default_factory=random.Random)  # nosec B311
    live: Optional[LiveLimits] = None  # None means a mock dialer, no live checks
    calls_placed: int = 0

    # ---- intake -----------------------------------------------------------

    def enqueue(self, contacts: Sequence[Contact]) -> int:
        """Add new booking requests. The first call also waits for the calling window."""
        moment = self.now()
        added = 0
        for contact in contacts:
            first = next_window_open(moment, contact.timezone, self.policy)
            added += self.ledger.add([contact], first)
        return added

    # ---- recovery ---------------------------------------------------------

    def recover(self) -> int:
        """Close attempts left open by a crash. Never redials on its own."""
        fixed = 0
        for row in self.ledger.open_attempts():
            request = self.ledger.get(row["request_id"])
            if row["call_id"]:
                result = self.dialer.wait(row["call_id"])
                self._record(request, row["n"], row["call_id"], result)
            else:
                moment = self.now()
                self.ledger.finish_attempt(
                    request.id, row["n"], now=moment, outcome=Outcome.NEEDS_REVIEW,
                    call_status="unknown", duration_secs=0.0,
                    note="stopped before a call id was saved",
                    retry_at=None, reason="check the Atoms call log before redialling",
                )
            fixed += 1
        return fixed

    # ---- one pass ---------------------------------------------------------

    def run_due(self) -> int:
        """Process every request that is due now. Returns how many were handled."""
        handled = 0
        for request in self.ledger.due(self.now(), limit=100):
            if self.live and self.calls_placed >= self.live.max_calls_per_run:
                log.warning("per-run call cap reached (%d), stopping", self.live.max_calls_per_run)
                break
            if self._attempt(request):
                handled += 1
        return handled

    def _attempt(self, request: Request) -> bool:
        moment = self.now()
        contact = Contact(request.id, request.name, request.phone, request.timezone, request.service, "ledger")

        # Suppression is checked on every attempt, not only the first.
        suppressed = self.ledger.suppressed_numbers()
        if request.phone in suppressed:
            self.ledger.finish_request(request.id, Outcome.DO_NOT_CALL.value, "number is suppressed", moment)
            return False
        if self.live:
            try:
                live_dial_check(request.phone, self.live.allowed_prefixes, suppressed)
            except InputError as exc:
                self.ledger.finish_request(request.id, Outcome.BLOCKED.value, str(exc), moment)
                return False

        n = self.ledger.claim(request.id, moment)
        if n is None:
            return False

        try:
            call_id = self.dialer.place(contact, n)
        except (StartRejected, StartTransient, StartUncertain) as exc:
            outcome = {
                StartRejected: Outcome.START_REJECTED,
                StartTransient: Outcome.START_ERROR,
                StartUncertain: Outcome.NEEDS_REVIEW,
            }[type(exc)]
            self._record(request, n, None, CallResult(status="not_started", failure_reason=str(exc)), forced=outcome)
            return True

        self.calls_placed += 1
        self.ledger.set_call_id(request.id, n, call_id)
        log.info("attempt %d placed: %s", n, describe(contact, call_id))
        result = self.dialer.wait(call_id)
        self._record(request, n, call_id, result)
        return True

    # ---- recording --------------------------------------------------------

    def _record(
        self,
        request: Request,
        n: int,
        call_id: Optional[str],
        result: CallResult,
        forced: Optional[Outcome] = None,
    ) -> None:
        moment = self.now()
        outcome = forced or classify(result, self.policy)
        fresh = self.ledger.get(request.id)
        voicemails = fresh.voicemails + (1 if outcome is Outcome.VOICEMAIL else 0)
        first = fresh.first_attempt_at or moment

        decision = decide(
            outcome,
            attempts_made=fresh.attempts,
            voicemails_so_far=voicemails,
            first_attempt_at=first,
            now=moment,
            tz_name=fresh.timezone,
            policy=self.policy,
            rng=self.rng,
        )
        note = (result.failure_reason or "")[:200]
        self.ledger.finish_attempt(
            request.id, n, now=moment, outcome=outcome, call_status=result.status,
            duration_secs=result.duration_secs, note=note,
            retry_at=decision.next_at if decision.retry else None,
            reason=decision.reason,
        )
        if outcome in SUPPRESS:
            self.ledger.suppress(fresh.phone, outcome.value, moment)
        log.info(
            "attempt %d for %s: %s (%s)", n, mask(fresh.phone), outcome.value, decision.reason
        )
