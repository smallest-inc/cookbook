"""Input checks. Everything that reaches the dialer passes through here.

A booking agent dials phone numbers, so a bad row in a CSV must not turn into
a call. These checks are strict on purpose: when in doubt, the row is rejected
with a reason and nothing is dialled.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence
from zoneinfo import ZoneInfo

E164 = re.compile(r"^\+[1-9]\d{7,14}$")
CONTACT_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
# Letters, digits, spaces and common name punctuation only. No brackets, braces,
# quotes or newlines, because the name is injected into the agent's prompt.
NAME = re.compile(r"^[\w .,'’-]{1,60}$")
TZ_NAME = re.compile(r"^[A-Za-z_]+(?:/[A-Za-z0-9_+-]+){0,2}$")
HEX_ID = re.compile(r"^[0-9a-fA-F]{24}$")
PREFIX = re.compile(r"^\+[1-9]\d{0,3}$")

# The services the agent may book. Free text from a CSV never reaches the prompt.
SERVICES = ("consultation", "checkup", "follow_up")

MAX_CSV_BYTES = 256 * 1024
MAX_ROWS = 500
REQUIRED_COLUMNS = ("id", "name", "phone", "timezone", "service", "consent", "consent_source")


class InputError(ValueError):
    """A row or setting failed validation. The message never includes secrets."""


@dataclass(frozen=True)
class Contact:
    id: str
    name: str
    phone: str
    timezone: str
    service: str
    consent_source: str


def mask(phone: str) -> str:
    """Show only the last two digits in logs and reports."""
    return "+" + "*" * max(len(phone) - 3, 0) + phone[-2:]


def validate_row(row: dict[str, str], line: int) -> Contact:
    def bad(msg: str) -> InputError:
        return InputError(f"row {line}: {msg}")

    cid = (row.get("id") or "").strip()
    name = (row.get("name") or "").strip()
    phone = (row.get("phone") or "").strip()
    tz = (row.get("timezone") or "").strip()
    service = (row.get("service") or "").strip().lower()
    consent = (row.get("consent") or "").strip().lower()
    source = (row.get("consent_source") or "").strip()

    if not CONTACT_ID.match(cid):
        raise bad("id must be 1-40 letters, digits, dash or underscore")
    if not NAME.match(name):
        raise bad("name has unsupported characters or is too long")
    if not E164.match(phone):
        raise bad("phone must be E.164, for example +14155550123")
    if not TZ_NAME.match(tz):
        raise bad("timezone must be an IANA name such as Asia/Kolkata")
    try:
        ZoneInfo(tz)
    except Exception as exc:  # unknown key, or no tzdata installed
        raise bad("unknown timezone") from exc
    if service not in SERVICES:
        raise bad(f"service must be one of {', '.join(SERVICES)}")
    if consent != "yes":
        raise bad("consent must be 'yes'. Never add a person who has not agreed to be called")
    if not 3 <= len(source) <= 80 or any(ord(c) < 32 for c in source):
        raise bad("consent_source must say where the consent came from (3-80 characters)")
    return Contact(cid, name, phone, tz, service, source)


def load_contacts(path: Path) -> list[Contact]:
    path = Path(path)
    if not path.is_file():
        raise InputError("contacts file not found")
    if path.stat().st_size > MAX_CSV_BYTES:
        raise InputError(f"contacts file is larger than {MAX_CSV_BYTES // 1024} KB")
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise InputError(f"contacts file is missing columns: {', '.join(missing)}")
        contacts: list[Contact] = []
        seen_ids: set[str] = set()
        seen_phones: set[str] = set()
        for line, row in enumerate(reader, start=2):
            if len(contacts) >= MAX_ROWS:
                raise InputError(f"more than {MAX_ROWS} rows")
            contact = validate_row(row, line)
            if contact.id in seen_ids:
                raise InputError(f"row {line}: duplicate id")
            if contact.phone in seen_phones:
                raise InputError(f"row {line}: duplicate phone number")
            seen_ids.add(contact.id)
            seen_phones.add(contact.phone)
            contacts.append(contact)
    return contacts


def parse_prefixes(raw: str) -> tuple[str, ...]:
    """Parse a list of country calling codes such as '+1,+91'."""
    items = [p.strip() for p in raw.split(",") if p.strip()]
    for item in items:
        if not PREFIX.match(item):
            raise InputError(f"bad country prefix {item!r}, expected something like +91")
    return tuple(items)


def live_dial_check(phone: str, allowed_prefixes: Sequence[str], suppressed: Iterable[str]) -> None:
    """Extra checks that only apply before a real call. Raises InputError."""
    if not allowed_prefixes:
        raise InputError("BOOKING_ALLOWED_PREFIXES is empty, refusing to dial")
    if not any(phone.startswith(p) for p in allowed_prefixes):
        raise InputError("number is outside the allowed country prefixes")
    if phone in set(suppressed):
        raise InputError("number is on the suppression list")


def check_hex_id(value: str, label: str) -> str:
    if not HEX_ID.match(value or ""):
        raise InputError(f"{label} must be a 24 character hex id")
    return value
