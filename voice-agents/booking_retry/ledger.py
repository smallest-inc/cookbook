"""SQLite ledger: one row per booking request, one row per dial attempt.

The ledger is what makes retries safe. An attempt row is written before the
call is placed, so a crash can never lead to a silent double dial. On restart,
an attempt with no call id is flagged for a human instead of being redialled.

Every statement is parameterised. The file holds phone numbers, so it is in
.gitignore and should be treated as personal data.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Optional

from guard import Contact
from policy import Outcome

SCHEMA = """
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    timezone TEXT NOT NULL,
    service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',      -- pending | calling | done
    outcome TEXT,                                 -- last or final Outcome value
    reason TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    voicemails INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TEXT,
    next_attempt_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
    request_id TEXT NOT NULL REFERENCES requests(id),
    n INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    call_id TEXT,
    call_status TEXT,
    outcome TEXT,
    duration_secs REAL,
    note TEXT,
    PRIMARY KEY (request_id, n)
);
CREATE TABLE IF NOT EXISTS suppressed (
    phone TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    added_at TEXT NOT NULL
);
"""


def iso(moment: datetime) -> str:
    if moment.tzinfo is None:
        raise ValueError("datetimes must be timezone-aware")
    return moment.astimezone(timezone.utc).isoformat(timespec="seconds")


def parse(value: str) -> datetime:
    return datetime.fromisoformat(value)


@dataclass(frozen=True)
class Request:
    id: str
    name: str
    phone: str
    timezone: str
    service: str
    status: str
    outcome: Optional[str]
    reason: Optional[str]
    attempts: int
    voicemails: int
    first_attempt_at: Optional[datetime]
    next_attempt_at: datetime


class Ledger:
    def __init__(self, path: str = ":memory:") -> None:
        self.db = sqlite3.connect(path, timeout=10)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(SCHEMA)

    def close(self) -> None:
        self.db.close()

    # ---- requests ---------------------------------------------------------

    def add(self, contacts: Iterable[Contact], now: datetime) -> int:
        """Insert new requests. Existing ids are left untouched (idempotent)."""
        added = 0
        for c in contacts:
            cur = self.db.execute(
                "INSERT OR IGNORE INTO requests (id, name, phone, timezone, service, next_attempt_at, updated_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (c.id, c.name, c.phone, c.timezone, c.service, iso(now), iso(now)),
            )
            added += cur.rowcount
        self.db.commit()
        return added

    @staticmethod
    def _row(row: sqlite3.Row) -> Request:
        return Request(
            id=row["id"],
            name=row["name"],
            phone=row["phone"],
            timezone=row["timezone"],
            service=row["service"],
            status=row["status"],
            outcome=row["outcome"],
            reason=row["reason"],
            attempts=row["attempts"],
            voicemails=row["voicemails"],
            first_attempt_at=parse(row["first_attempt_at"]) if row["first_attempt_at"] else None,
            next_attempt_at=parse(row["next_attempt_at"]),
        )

    def get(self, request_id: str) -> Request:
        row = self.db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        if row is None:
            raise KeyError(request_id)
        return self._row(row)

    def due(self, now: datetime, limit: int) -> list[Request]:
        rows = self.db.execute(
            "SELECT * FROM requests WHERE status = 'pending' AND next_attempt_at <= ?"
            " ORDER BY next_attempt_at, id LIMIT ?",
            (iso(now), limit),
        ).fetchall()
        return [self._row(r) for r in rows]

    def next_due_at(self) -> Optional[datetime]:
        row = self.db.execute(
            "SELECT MIN(next_attempt_at) AS t FROM requests WHERE status = 'pending'"
        ).fetchone()
        return parse(row["t"]) if row and row["t"] else None

    def all(self) -> list[Request]:
        return [self._row(r) for r in self.db.execute("SELECT * FROM requests ORDER BY id")]

    # ---- attempts ---------------------------------------------------------

    def claim(self, request_id: str, now: datetime) -> Optional[int]:
        """Move a pending request to 'calling' and open attempt n.

        Returns the attempt number, or None if someone else got there first.
        """
        with self.db:
            cur = self.db.execute(
                "UPDATE requests SET status = 'calling', attempts = attempts + 1,"
                " first_attempt_at = COALESCE(first_attempt_at, ?), updated_at = ?"
                " WHERE id = ? AND status = 'pending'",
                (iso(now), iso(now), request_id),
            )
            if cur.rowcount != 1:
                return None
            n = self.db.execute("SELECT attempts FROM requests WHERE id = ?", (request_id,)).fetchone()[0]
            self.db.execute(
                "INSERT INTO attempts (request_id, n, started_at) VALUES (?, ?, ?)",
                (request_id, n, iso(now)),
            )
        return n

    def set_call_id(self, request_id: str, n: int, call_id: str) -> None:
        with self.db:
            self.db.execute(
                "UPDATE attempts SET call_id = ? WHERE request_id = ? AND n = ?", (call_id, request_id, n)
            )

    def finish_attempt(
        self,
        request_id: str,
        n: int,
        *,
        now: datetime,
        outcome: Outcome,
        call_status: str,
        duration_secs: float,
        note: str,
        retry_at: Optional[datetime],
        reason: str,
    ) -> None:
        """Close attempt n and either schedule the next try or finish the request."""
        with self.db:
            self.db.execute(
                "UPDATE attempts SET ended_at = ?, call_status = ?, outcome = ?, duration_secs = ?, note = ?"
                " WHERE request_id = ? AND n = ?",
                (iso(now), call_status, outcome.value, duration_secs, note, request_id, n),
            )
            voicemail_inc = 1 if outcome is Outcome.VOICEMAIL else 0
            if retry_at is not None:
                self.db.execute(
                    "UPDATE requests SET status = 'pending', outcome = ?, reason = ?, next_attempt_at = ?,"
                    " voicemails = voicemails + ?, updated_at = ? WHERE id = ?",
                    (outcome.value, reason, iso(retry_at), voicemail_inc, iso(now), request_id),
                )
            else:
                self.db.execute(
                    "UPDATE requests SET status = 'done', outcome = ?, reason = ?,"
                    " voicemails = voicemails + ?, updated_at = ? WHERE id = ?",
                    (outcome.value, reason, voicemail_inc, iso(now), request_id),
                )

    def finish_request(self, request_id: str, outcome: str, reason: str, now: datetime) -> None:
        with self.db:
            self.db.execute(
                "UPDATE requests SET status = 'done', outcome = ?, reason = ?, updated_at = ? WHERE id = ?",
                (outcome, reason, iso(now), request_id),
            )

    def open_attempts(self) -> list[sqlite3.Row]:
        """Attempts that started but never recorded an end (a crash, a Ctrl-C)."""
        return self.db.execute(
            "SELECT request_id, n, call_id FROM attempts WHERE ended_at IS NULL ORDER BY request_id, n"
        ).fetchall()

    def attempts_for(self, request_id: str) -> list[sqlite3.Row]:
        return self.db.execute(
            "SELECT * FROM attempts WHERE request_id = ? ORDER BY n", (request_id,)
        ).fetchall()

    # ---- suppression ------------------------------------------------------

    def suppress(self, phone: str, reason: str, now: datetime) -> None:
        with self.db:
            self.db.execute(
                "INSERT OR IGNORE INTO suppressed (phone, reason, added_at) VALUES (?, ?, ?)",
                (phone, reason, iso(now)),
            )

    def suppressed_numbers(self) -> set[str]:
        return {r[0] for r in self.db.execute("SELECT phone FROM suppressed")}
