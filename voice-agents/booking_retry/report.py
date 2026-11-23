"""Plain-text report of what happened to each booking request."""

from __future__ import annotations

from collections import Counter

from guard import mask
from ledger import Ledger


def render(ledger: Ledger) -> str:
    rows = ledger.all()
    lines = [f"{'id':<12}{'phone':<16}{'tries':>5}  {'status':<8}{'outcome':<20}reason"]
    for r in rows:
        lines.append(
            f"{r.id:<12}{mask(r.phone):<16}{r.attempts:>5}  {r.status:<8}{(r.outcome or '-'):<20}{r.reason or ''}"
        )
    totals = Counter((r.outcome or "pending") for r in rows)
    lines.append("")
    lines.append("totals: " + ", ".join(f"{k}={v}" for k, v in sorted(totals.items())))
    return "\n".join(lines)


def timeline(ledger: Ledger, request_id: str) -> str:
    out = [f"{request_id}:"]
    for a in ledger.attempts_for(request_id):
        out.append(
            f"  #{a['n']} {a['started_at']}  {a['call_status'] or '...'}  -> {a['outcome'] or 'open'}"
            f"  ({a['duration_secs'] or 0:.0f}s)"
        )
    return "\n".join(out)
