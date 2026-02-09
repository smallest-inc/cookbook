"""Banking database — SQLite schema, seed data, and query helpers.

Creates an in-memory SQLite database seeded with synthetic banking data
for a single customer (Ajay Kumar). The database is created fresh for
every agent session so state is isolated.
"""

import json
import re
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS customers (
    id              INTEGER PRIMARY KEY,
    name            TEXT    NOT NULL,
    gender          TEXT,
    dob             TEXT,           -- YYYY-MM-DD
    cibil_score     INTEGER,
    mothers_maiden  TEXT,
    address         TEXT,
    city            TEXT,
    state           TEXT,
    pincode         TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
    id              INTEGER PRIMARY KEY,
    customer_id     INTEGER NOT NULL,
    type            TEXT    NOT NULL,  -- 'savings'
    account_number  TEXT    NOT NULL,
    balance         INTEGER NOT NULL,  -- in whole rupees
    currency        TEXT    DEFAULT 'INR',
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS fixed_deposits (
    id              INTEGER PRIMARY KEY,
    customer_id     INTEGER NOT NULL,
    account_number  TEXT    NOT NULL,
    principal       INTEGER NOT NULL,  -- in whole rupees
    open_date       TEXT    NOT NULL,  -- YYYY-MM-DD
    tenure          TEXT    NOT NULL,  -- e.g. '1 Year', '2 Years'
    interest_rate   REAL    NOT NULL,  -- e.g. 7.50
    maturity_date   TEXT,              -- YYYY-MM-DD
    is_active       INTEGER DEFAULT 1,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS cards (
    id              INTEGER PRIMARY KEY,
    customer_id     INTEGER NOT NULL,
    type            TEXT    NOT NULL,  -- 'debit' / 'credit'
    network         TEXT,             -- 'Mastercard' / 'Visa'
    last_four       TEXT    NOT NULL,
    expiry          TEXT,
    credit_limit    INTEGER,
    apr             REAL,
    offers          TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL,
    date            TEXT    NOT NULL,  -- YYYY-MM-DD
    description     TEXT    NOT NULL,
    debit           INTEGER DEFAULT 0,  -- in whole rupees
    credit          INTEGER DEFAULT 0,
    balance         INTEGER DEFAULT 0,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    details         TEXT
);
"""

# ---------------------------------------------------------------------------
# Seed data  (derived from synthetic-data-examples CSVs, cleaned)
# ---------------------------------------------------------------------------

CUSTOMER = {
    "id": 1,
    "name": "Ajay Kumar",
    "gender": "Male",
    "dob": "1988-02-15",
    "cibil_score": 820,
    "mothers_maiden": "Sunita Tiwari",
    "address": "Suite 105, Embassy Enclave, Powai, Mumbai 400072, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400072",
}

ACCOUNT = {
    "id": 1,
    "customer_id": 1,
    "type": "savings",
    "account_number": "002-002-500-004",
    "balance": 820201,
    "currency": "INR",
}

FIXED_DEPOSITS = [
    {
        "id": 1,
        "customer_id": 1,
        "account_number": "003-002-500-007",
        "principal": 1500000,
        "open_date": "2025-03-15",
        "tenure": "1 Year",
        "interest_rate": 7.50,
        "maturity_date": "2026-03-15",
        "is_active": 1,
    },
    {
        "id": 2,
        "customer_id": 1,
        "account_number": "004-002-500-009",
        "principal": 2000000,
        "open_date": "2024-11-01",
        "tenure": "2 Years",
        "interest_rate": 7.50,
        "maturity_date": "2026-11-01",
        "is_active": 1,
    },
]

CARDS = [
    {
        "id": 1,
        "customer_id": 1,
        "type": "debit",
        "network": "Mastercard",
        "last_four": "0437",
        "expiry": "2029-10-31",
        "credit_limit": None,
        "apr": None,
        "offers": None,
    },
    {
        "id": 2,
        "customer_id": 1,
        "type": "credit",
        "network": None,
        "last_four": "0432",
        "expiry": "2028-11-30",
        "credit_limit": 1500000,
        "apr": 29.99,
        "offers": "Eligible for 50% increase in credit limit",
    },
]

# Cleaned & date-normalized transaction ledger.
# Dates are YYYY-MM-DD.  Amounts in whole rupees.
# fmt: off
TRANSACTIONS: List[Dict[str, Any]] = [
    {"date": "2024-01-01", "description": "Credit from ABC Traders",        "debit": 0,      "credit": 10000,  "balance": 630000},
    {"date": "2024-01-10", "description": "FBI Cards",                      "debit": 35000,   "credit": 0,      "balance": 595000},
    {"date": "2024-01-18", "description": "Swiggy",                         "debit": 2800,    "credit": 0,      "balance": 720200},
    {"date": "2024-01-28", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 870200},
    {"date": "2024-01-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 745000},
    {"date": "2024-02-10", "description": "Adani Electricity",              "debit": 18000,   "credit": 0,      "balance": 727000},
    {"date": "2024-02-15", "description": "Swiggy",                         "debit": 4000,    "credit": 0,      "balance": 723000},
    {"date": "2024-03-01", "description": "Amazon",                         "debit": 24000,   "credit": 0,      "balance": 846200},
    {"date": "2024-03-10", "description": "Amazon",                         "debit": 18000,   "credit": 0,      "balance": 828200},
    {"date": "2024-03-11", "description": "Swiggy",                         "debit": 4000,    "credit": 0,      "balance": 824200},
    {"date": "2024-03-18", "description": "Jyoti Kumar",                    "debit": 50000,   "credit": 0,      "balance": 774200},
    {"date": "2024-03-28", "description": "Amazon",                         "debit": 15000,   "credit": 0,      "balance": 759200},
    {"date": "2024-03-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 909200},
    {"date": "2024-03-31", "description": "FBI Cards",                      "debit": 74000,   "credit": 0,      "balance": 835200},
    {"date": "2024-04-01", "description": "Adani Electricity",              "debit": 14000,   "credit": 0,      "balance": 821200},
    {"date": "2024-04-15", "description": "Jyoti Kumar",                    "debit": 50000,   "credit": 0,      "balance": 771200},
    {"date": "2024-04-22", "description": "Swiggy",                         "debit": 6000,    "credit": 0,      "balance": 765200},
    {"date": "2024-04-24", "description": "Amazon",                         "debit": 13000,   "credit": 0,      "balance": 752200},
    {"date": "2024-04-30", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 902200},
    {"date": "2024-05-01", "description": "Adani Electricity",              "debit": 14000,   "credit": 0,      "balance": 888200},
    {"date": "2024-05-10", "description": "Reliance Dividend",              "debit": 0,       "credit": 210000, "balance": 1098200},
    {"date": "2024-05-14", "description": "Swiggy",                         "debit": 8000,    "credit": 0,      "balance": 1090200},
    {"date": "2024-05-16", "description": "Dell Computer Zone",             "debit": 400000,  "credit": 0,      "balance": 690200},
    {"date": "2024-05-24", "description": "Amazon",                         "debit": 33000,   "credit": 0,      "balance": 657200},
    {"date": "2024-05-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 807200},
    {"date": "2024-06-01", "description": "Adani Electricity",              "debit": 14000,   "credit": 0,      "balance": 793200},
    {"date": "2024-06-14", "description": "Amazon",                         "debit": 32000,   "credit": 0,      "balance": 761200},
    {"date": "2024-06-18", "description": "Annual Municipal Tax",           "debit": 120000,  "credit": 0,      "balance": 641200},
    {"date": "2024-06-24", "description": "Tata Capital Dividend",          "debit": 0,       "credit": 200000, "balance": 841200},
    {"date": "2024-06-28", "description": "Swiggy",                         "debit": 23000,   "credit": 0,      "balance": 818200},
    {"date": "2024-06-30", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 968200},
    {"date": "2024-07-01", "description": "Adani Electricity",              "debit": 12000,   "credit": 0,      "balance": 956200},
    {"date": "2024-07-10", "description": "Amazon",                         "debit": 25000,   "credit": 0,      "balance": 931200},
    {"date": "2024-07-15", "description": "Swiggy",                         "debit": 12000,   "credit": 0,      "balance": 919200},
    {"date": "2024-07-28", "description": "Jyoti Kumar",                    "debit": 50000,   "credit": 0,      "balance": 869200},
    {"date": "2024-07-30", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1019200},
    {"date": "2024-08-01", "description": "Adani Electricity",              "debit": 21000,   "credit": 0,      "balance": 998200},
    {"date": "2024-08-15", "description": "Amazon",                         "debit": 34000,   "credit": 0,      "balance": 964200},
    {"date": "2024-08-17", "description": "Swiggy",                         "debit": 12000,   "credit": 0,      "balance": 952200},
    {"date": "2024-08-23", "description": "Airtel Broadband Annual Fee",    "debit": 35000,   "credit": 0,      "balance": 917200},
    {"date": "2024-08-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1067200},
    {"date": "2024-09-01", "description": "Adani Electricity",              "debit": 21000,   "credit": 0,      "balance": 1046200},
    {"date": "2024-09-14", "description": "Amazon",                         "debit": 42000,   "credit": 0,      "balance": 1004200},
    {"date": "2024-09-22", "description": "Jyoti Kumar",                    "debit": 50000,   "credit": 0,      "balance": 954200},
    {"date": "2024-09-30", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1104200},
    {"date": "2024-10-01", "description": "Adani Electricity",              "debit": 21000,   "credit": 0,      "balance": 1083200},
    {"date": "2024-10-02", "description": "Samsung Electronics",            "debit": 150000,  "credit": 0,      "balance": 966200},
    {"date": "2024-10-05", "description": "Amazon",                         "debit": 30000,   "credit": 0,      "balance": 1053200},
    {"date": "2024-10-10", "description": "Swiggy",                         "debit": 12000,   "credit": 0,      "balance": 1041200},
    {"date": "2024-10-14", "description": "Amazon",                         "debit": 29000,   "credit": 0,      "balance": 937200},
    {"date": "2024-10-15", "description": "Uber",                           "debit": 3000,    "credit": 0,      "balance": 1003201},
    {"date": "2024-10-16", "description": "Uber",                           "debit": 4000,    "credit": 0,      "balance": 999201},
    {"date": "2024-10-20", "description": "Jyoti Kumar",                    "debit": 50000,   "credit": 0,      "balance": 991200},
    {"date": "2024-10-20", "description": "Swiggy",                         "debit": 14000,   "credit": 0,      "balance": 923200},
    {"date": "2024-10-22", "description": "ATM Cash Withdrawal",            "debit": 10000,   "credit": 0,      "balance": 981200},
    {"date": "2024-10-28", "description": "Jyoti Kumar",                    "debit": 50000,   "credit": 0,      "balance": 873200},
    {"date": "2024-10-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1131200},
    {"date": "2024-10-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1023200},
    {"date": "2024-11-01", "description": "Adani Electricity",              "debit": 15000,   "credit": 0,      "balance": 1116200},
    {"date": "2024-11-01", "description": "Adani Electricity",              "debit": 14000,   "credit": 0,      "balance": 1009200},
    {"date": "2024-11-15", "description": "Amazon",                         "debit": 43000,   "credit": 0,      "balance": 966200},
    {"date": "2024-11-20", "description": "Swiggy",                         "debit": 13000,   "credit": 0,      "balance": 953200},
    {"date": "2024-11-24", "description": "Reliance Dividend",              "debit": 0,       "credit": 200000, "balance": 1153200},
    {"date": "2024-11-28", "description": "Indigo Airlines",                "debit": 243999,  "credit": 0,      "balance": 909201},
    {"date": "2024-11-30", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1059201},
    {"date": "2024-12-01", "description": "Adani Electricity",              "debit": 15000,   "credit": 0,      "balance": 1044201},
    {"date": "2024-12-10", "description": "Amazon",                         "debit": 38000,   "credit": 0,      "balance": 1006201},
    {"date": "2024-12-22", "description": "Swiggy",                         "debit": 12000,   "credit": 0,      "balance": 987201},
    {"date": "2024-12-28", "description": "Indigo Airlines",                "debit": 84000,   "credit": 0,      "balance": 903201},
    {"date": "2024-12-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1053201},
    {"date": "2024-12-31", "description": "Jyoti Kumar",                    "debit": 300000,  "credit": 0,      "balance": 753201},
    {"date": "2025-01-01", "description": "Adani Electricity",              "debit": 15000,   "credit": 0,      "balance": 738201},
    {"date": "2025-01-05", "description": "Amazon",                         "debit": 49000,   "credit": 0,      "balance": 689201},
    {"date": "2025-01-10", "description": "Uber",                           "debit": 4000,    "credit": 0,      "balance": 685201},
    {"date": "2025-01-15", "description": "Swiggy",                         "debit": 15000,   "credit": 0,      "balance": 670201},
    {"date": "2025-01-22", "description": "Swiggy",                         "debit": 20000,   "credit": 0,      "balance": 650201},
    {"date": "2025-01-29", "description": "Reliance Dividend",              "debit": 0,       "credit": 200000, "balance": 850201},
    {"date": "2025-01-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 1000201},
    {"date": "2025-02-01", "description": "Suzuki Cars Plaza",              "debit": 735000,  "credit": 0,      "balance": 265201},
    {"date": "2025-02-01", "description": "Adani Electricity",              "debit": 14000,   "credit": 0,      "balance": 251201},
    {"date": "2025-02-15", "description": "Amazon",                         "debit": 30000,   "credit": 0,      "balance": 221201},
    {"date": "2025-02-28", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 371201},
    {"date": "2025-03-01", "description": "Adani Electricity",              "debit": 14000,   "credit": 0,      "balance": 357201},
    {"date": "2025-03-10", "description": "Tata Capital Dividend",          "debit": 0,       "credit": 300000, "balance": 657201},
    {"date": "2025-03-15", "description": "Amazon",                         "debit": 30000,   "credit": 0,      "balance": 627201},
    {"date": "2025-03-22", "description": "Uber",                           "debit": 4000,    "credit": 0,      "balance": 623201},
    {"date": "2025-03-28", "description": "Airtel Mobile Postpaid Annual",  "debit": 36000,   "credit": 0,      "balance": 587201},
    {"date": "2025-03-31", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 737201},
    {"date": "2025-04-01", "description": "Adani Electricity",              "debit": 15000,   "credit": 0,      "balance": 722201},
    {"date": "2025-04-10", "description": "Amazon",                         "debit": 34000,   "credit": 0,      "balance": 688201},
    {"date": "2025-04-15", "description": "Uber",                           "debit": 4000,    "credit": 0,      "balance": 684201},
    {"date": "2025-04-18", "description": "Swiggy",                         "debit": 14000,   "credit": 0,      "balance": 670201},
    {"date": "2025-04-30", "description": "Rent Received",                  "debit": 0,       "credit": 150000, "balance": 820201},
]
# fmt: on


# ---------------------------------------------------------------------------
# Database helper
# ---------------------------------------------------------------------------


class BankingDB:
    """Thin wrapper around an in-memory SQLite database."""

    def __init__(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self._create_schema()
        self._seed()
        logger.info("[BankingDB] Database initialised and seeded")

    # -- setup ---------------------------------------------------------------

    def _create_schema(self):
        self.conn.executescript(SCHEMA_SQL)

    def _seed(self):
        cur = self.conn.cursor()

        # Customer
        c = CUSTOMER
        cur.execute(
            "INSERT INTO customers VALUES (?,?,?,?,?,?,?,?,?,?)",
            (c["id"], c["name"], c["gender"], c["dob"], c["cibil_score"],
             c["mothers_maiden"], c["address"], c["city"], c["state"], c["pincode"]),
        )

        # Account
        a = ACCOUNT
        cur.execute(
            "INSERT INTO accounts VALUES (?,?,?,?,?,?)",
            (a["id"], a["customer_id"], a["type"], a["account_number"],
             a["balance"], a["currency"]),
        )

        # Fixed deposits
        for fd in FIXED_DEPOSITS:
            cur.execute(
                "INSERT INTO fixed_deposits VALUES (?,?,?,?,?,?,?,?,?)",
                (fd["id"], fd["customer_id"], fd["account_number"],
                 fd["principal"], fd["open_date"], fd["tenure"],
                 fd["interest_rate"], fd["maturity_date"], fd["is_active"]),
            )

        # Cards
        for card in CARDS:
            cur.execute(
                "INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?)",
                (card["id"], card["customer_id"], card["type"], card["network"],
                 card["last_four"], card["expiry"], card["credit_limit"],
                 card["apr"], card["offers"]),
            )

        # Transactions
        for tx in TRANSACTIONS:
            cur.execute(
                "INSERT INTO transactions (account_id, date, description, debit, credit, balance) "
                "VALUES (?,?,?,?,?,?)",
                (1, tx["date"], tx["description"], tx["debit"], tx["credit"], tx["balance"]),
            )

        self.conn.commit()

    # -- query helpers -------------------------------------------------------

    def execute_read_query(self, sql: str) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return rows as list of dicts.

        Raises ValueError if the query is not a SELECT statement.
        """
        cleaned = sql.strip()

        # Safety: only allow SELECT
        if not re.match(r"(?i)^\s*SELECT\b", cleaned):
            raise ValueError("Only SELECT queries are allowed.")

        # Block dangerous keywords
        dangerous = re.compile(
            r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|PRAGMA)\b",
            re.IGNORECASE,
        )
        if dangerous.search(cleaned):
            raise ValueError("Query contains disallowed keywords.")

        cur = self.conn.execute(cleaned)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        return [dict(zip(columns, row)) for row in rows]

    def execute_write(self, sql: str, params: tuple = ()) -> int:
        """Execute a write query (INSERT/UPDATE). Returns lastrowid."""
        cur = self.conn.execute(sql, params)
        self.conn.commit()
        return cur.lastrowid

    def get_balance(self) -> int:
        """Get current savings account balance."""
        row = self.conn.execute(
            "SELECT balance FROM accounts WHERE id = 1"
        ).fetchone()
        return row["balance"] if row else 0

    def update_balance(self, new_balance: int):
        """Update savings account balance."""
        self.conn.execute(
            "UPDATE accounts SET balance = ? WHERE id = 1", (new_balance,)
        )
        self.conn.commit()

    def log_audit(self, event_type: str, details: str):
        """Write an entry to the audit_log table."""
        self.conn.execute(
            "INSERT INTO audit_log (timestamp, event_type, details) VALUES (?,?,?)",
            (datetime.utcnow().isoformat(), event_type, details),
        )
        self.conn.commit()

    def get_audit_log(self) -> List[Dict[str, Any]]:
        """Return the full audit log."""
        cur = self.conn.execute(
            "SELECT timestamp, event_type, details FROM audit_log ORDER BY id"
        )
        return [dict(row) for row in cur.fetchall()]

    def close(self):
        self.conn.close()


# ---------------------------------------------------------------------------
# Schema description for the LLM system prompt
# ---------------------------------------------------------------------------

DB_SCHEMA_DESCRIPTION = """
DATABASE SCHEMA (SQLite):

Table: customers
  - id (INTEGER PK)
  - name (TEXT)
  - gender (TEXT)
  - dob (TEXT, YYYY-MM-DD)
  - cibil_score (INTEGER)
  - mothers_maiden (TEXT)
  - address (TEXT)
  - city (TEXT)
  - state (TEXT)
  - pincode (TEXT)

Table: accounts
  - id (INTEGER PK)
  - customer_id (INTEGER FK -> customers.id)
  - type (TEXT: 'savings')
  - account_number (TEXT)
  - balance (INTEGER, in whole rupees)
  - currency (TEXT)

Table: fixed_deposits
  - id (INTEGER PK)
  - customer_id (INTEGER FK -> customers.id)
  - account_number (TEXT)
  - principal (INTEGER, in whole rupees)
  - open_date (TEXT, YYYY-MM-DD)
  - tenure (TEXT, e.g. '1 Year')
  - interest_rate (REAL, e.g. 7.50)
  - maturity_date (TEXT, YYYY-MM-DD)
  - is_active (INTEGER, 1=yes)

Table: cards
  - id (INTEGER PK)
  - customer_id (INTEGER FK -> customers.id)
  - type (TEXT: 'debit'/'credit')
  - network (TEXT)
  - last_four (TEXT)
  - expiry (TEXT)
  - credit_limit (INTEGER, rupees, nullable)
  - apr (REAL, nullable)
  - offers (TEXT, nullable)

Table: transactions
  - id (INTEGER PK AUTOINCREMENT)
  - account_id (INTEGER FK -> accounts.id)
  - date (TEXT, YYYY-MM-DD)
  - description (TEXT — merchant/payee name)
  - debit (INTEGER, rupees, 0 if credit)
  - credit (INTEGER, rupees, 0 if debit)
  - balance (INTEGER, rupees)

NOTES:
- There is one customer (id=1) in the database.
- All monetary amounts are in whole Indian Rupees (INR).
- Transaction dates range from 2024-01-01 to 2025-04-30.
- Use LIKE for fuzzy merchant matching, e.g. WHERE description LIKE '%Amazon%'.
- Use strftime('%Y', date) or strftime('%Y-%m', date) for date grouping.
""".strip()
