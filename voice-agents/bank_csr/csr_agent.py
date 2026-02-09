"""Rekha — Banking Customer Support Representative agent.

An OutputAgentNode that demonstrates:
- Multi-round tool chaining (query → analyse → respond)
- Real SQL queries against a live SQLite database
- Deterministic Python computation (no LLM for number-crunching)
- Session-based identity verification
- Banking actions (FD create/break, TDS certificate)
- Audit logging via a companion BackgroundAgentNode
"""

import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.clients.types import ToolCall, ToolResult
from smallestai.atoms.agent.events import (
    SDKAgentEndCallEvent,
    SDKAgentTransferConversationEvent,
    TransferOption,
    TransferOptionType,
)
from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.tools import ToolRegistry, function_tool

from audit_logger import AuditLogger
from database import BankingDB, DB_SCHEMA_DESCRIPTION

load_dotenv()

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = f"""You are **Rekha**, a voice-based Customer Support Representative for **Smallest Bank** (a dummy Indian bank).

## Your Role
Help the customer with account information, spending insights, and a small set of banking actions.
You have access to a real SQL database with the customer's accounts, transactions, fixed deposits, and cards.

## Voice & Conversation Style
- Sound like a professional Indian bank support rep: calm, helpful, efficient.
- Keep responses short: 1–3 sentences at a time. This is a phone call, not an essay.
- Confirm important details out loud before executing any action.

### Reading sensitive identifiers aloud
- Account numbers: read only the last 4 digits unless the customer explicitly asks.
- Card numbers: read only the last 4 digits. NEVER read full card numbers.
- Address: read only city and state unless the customer asks for the full address.

### Pronunciation rules (India-specific)
- "CVV" → say "C-V-V"
- "OTP" → say "O-T-P"
- "EMI" → say "E-M-I"
- ₹ → say "rupees"
- Read rupee amounts in the **Indian numbering system** (lakh, crore).
  - ₹350000 → "three lakh fifty thousand rupees"
  - ₹84250 → "eighty-four thousand two hundred and fifty rupees"
- Read mobile numbers and card digits **one digit at a time**, never grouped.

## Security — HARD RULES
You must **NEVER** ask for, accept, repeat, store, or verify using:
OTP, Card PIN, ATM PIN, MPIN, CVV, NetBanking password, UPI PIN, full card numbers.

If the customer starts sharing any of these, interrupt:
> "Please stop there. For your security, I cannot take OTP, PIN, CVV, or passwords on a call."

## Identity Verification
Use the `verify_customer` tool. Verify **once per conversation**.
- **Level 1** (account info, balances, spend queries): 2 matching factors.
- **Level 2** (banking actions — FD create/break, TDS send): 3 matching factors.

Allowed factors: full name, date of birth, city/state, last 4 digits of savings account, last 4 of debit card.
After successful verification **do NOT re-verify** unless a high-risk action is requested after a long detour.
If verification fails twice, offer to connect to a human agent.

## How to Answer Questions
1. **Always** use `execute_query` to fetch data from the database. Do NOT invent numbers.
2. For any computation (totals, trends, comparisons), pass the raw query results to `analyze_data`. Do NOT compute in your head.
3. Use the results from `analyze_data` to formulate your spoken response.
4. Speak amounts in the Indian numbering system (lakh / crore).

## Banking Actions You Can Take
- Break an FD (up to the full principal) and transfer to Savings.
- Create a new FD from Savings balance.
- Send TDS certificate for the last Financial Year over email.
- Transfer to a human agent (cold transfer) when the customer asks or you cannot help.
Anything else → politely refuse and offer to transfer to a human agent.

## Available Database
{DB_SCHEMA_DESCRIPTION}

## Edge Cases
- Data is available only through 2025-04-30. If asked beyond that, say so.
- If you don't have information, say so and offer a human agent.
- NEVER invent balances, rates, or offers not in the database.
""".strip()


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------


class CSRAgent(OutputAgentNode):
    """Rekha — Banking CSR with real database access and multi-round tool chaining."""

    def __init__(self, db: BankingDB, audit: AuditLogger):
        super().__init__(name="csr-agent")

        self.db = db
        self.audit = audit

        self.llm = OpenAIClient(
            model="gpt-4o",
            temperature=0.3,
            api_key=os.getenv("OPENAI_API_KEY"),
        )

        # Verification state (persists for the session)
        self.is_verified: bool = False
        self.verification_level: int = 0  # 0 = none, 1 = basic, 2 = high-risk

        # Tool setup
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        # System prompt
        self.context.add_message({"role": "system", "content": SYSTEM_PROMPT})

    # =========================================================================
    # Multi-round tool chaining in generate_response
    # =========================================================================

    async def generate_response(self):
        """Generate a response, looping through tool calls until the LLM
        produces a final text-only answer.  This enables chains like:
            execute_query → analyze_data → spoken answer
        """
        MAX_ROUNDS = 5

        for _round in range(MAX_ROUNDS):
            response = await self.llm.chat(
                messages=self.context.messages,
                stream=True,
                tools=self.tool_schemas,
            )

            tool_calls: List[ToolCall] = []
            full_response = ""

            async for chunk in response:
                if chunk.content:
                    full_response += chunk.content
                    yield chunk.content
                if chunk.tool_calls:
                    tool_calls.extend(chunk.tool_calls)

            # If no tools were called, we're done
            if not tool_calls:
                if full_response:
                    self.context.add_message(
                        {"role": "assistant", "content": full_response}
                    )
                return

            # Provide audible feedback while tools execute
            if _round == 0:
                yield "One moment while I look into that. "

            # Execute all tool calls
            results: List[ToolResult] = await self.tool_registry.execute(
                tool_calls=tool_calls, parallel=True
            )

            # Log tool calls to audit
            for tc, result in zip(tool_calls, results):
                try:
                    args = json.loads(tc.arguments)
                except Exception:
                    args = {"raw": tc.arguments}
                self.audit.log_tool_call(tc.name, args, result.content or "")

            # Add assistant + tool messages to context
            self.context.add_messages([
                {
                    "role": "assistant",
                    "content": full_response or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": str(tc.arguments),
                            },
                        }
                        for tc in tool_calls
                    ],
                },
                *[
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": "" if r.content is None else str(r.content),
                    }
                    for tc, r in zip(tool_calls, results)
                ],
            ])

            # Loop continues — LLM sees tool results and may call more tools

        # Safety: if we hit max rounds, let the LLM wrap up
        final = await self.llm.chat(
            messages=self.context.messages, stream=True
        )
        async for chunk in final:
            if chunk.content:
                yield chunk.content

    # =========================================================================
    # TOOL: Identity verification
    # =========================================================================

    @function_tool()
    def verify_customer(
        self,
        name: str = "",
        dob: str = "",
        account_last_four: str = "",
        city: str = "",
        debit_card_last_four: str = "",
    ) -> str:
        """Verify customer identity using Knowledge-Based Authentication.

        Provide at least 2 factors for Level 1 (info queries) or 3 for Level 2
        (banking actions).  Allowed factors: name, dob (YYYY-MM-DD), last 4
        digits of savings account number, city, last 4 digits of debit card.

        Args:
            name: Customer's full name as per bank records.
            dob: Date of birth in YYYY-MM-DD format.
            account_last_four: Last 4 characters of savings account number.
            city: City from the customer's address.
            debit_card_last_four: Last 4 digits of debit card.
        """
        if self.is_verified:
            return (
                f"Customer is already verified at Level {self.verification_level}. "
                "No need to re-verify."
            )

        # Fetch ground truth
        row = self.db.execute_read_query(
            "SELECT c.name, c.dob, c.city, a.account_number, ca.last_four AS debit_last_four "
            "FROM customers c "
            "JOIN accounts a ON a.customer_id = c.id "
            "JOIN cards ca ON ca.customer_id = c.id AND ca.type = 'debit' "
            "LIMIT 1"
        )
        if not row:
            return "ERROR: No customer data found."

        truth = row[0]
        factors_matched: List[str] = []

        if name and name.strip().lower() == truth["name"].strip().lower():
            factors_matched.append("name")

        if dob and dob.strip() == truth["dob"]:
            factors_matched.append("dob")

        if account_last_four:
            actual_last4 = truth["account_number"].replace("-", "")[-4:]
            if account_last_four.strip() == actual_last4:
                factors_matched.append("account_last_four")

        if city and city.strip().lower() == truth["city"].strip().lower():
            factors_matched.append("city")

        if debit_card_last_four:
            if debit_card_last_four.strip() == truth["debit_last_four"]:
                factors_matched.append("debit_card_last_four")

        n = len(factors_matched)
        self.audit.log_verification(success=n >= 2, factors_used=factors_matched)

        if n >= 3:
            self.is_verified = True
            self.verification_level = 2
            return f"Identity verified (Level 2 — high-risk actions allowed). Factors matched: {', '.join(factors_matched)}."
        elif n >= 2:
            self.is_verified = True
            self.verification_level = 1
            return f"Identity verified (Level 1 — account info access). Factors matched: {', '.join(factors_matched)}."
        else:
            return (
                f"Verification failed. Only {n} factor(s) matched: "
                f"{', '.join(factors_matched) if factors_matched else 'none'}. "
                "Please ask the customer for more details or offer to connect to a human agent."
            )

    # =========================================================================
    # TOOL: Execute SQL query
    # =========================================================================

    @function_tool()
    def execute_query(self, sql: str) -> str:
        """Execute a read-only SQL query against the banking database.

        Write a SELECT query to retrieve data. Only SELECT is allowed.
        Returns JSON array of result rows.

        Args:
            sql: A SELECT query to run.  Use LIKE for fuzzy merchant matching.
                 Use strftime for date grouping.
        """
        try:
            rows = self.db.execute_read_query(sql)
            # Cap output to avoid exceeding context
            if len(rows) > 200:
                rows = rows[:200]
                return json.dumps(rows) + "\n... (truncated to 200 rows)"
            return json.dumps(rows)
        except Exception as e:
            return f"QUERY ERROR: {e}"

    # =========================================================================
    # TOOL: Deterministic analysis (pure Python, no LLM)
    # =========================================================================

    @function_tool()
    def analyze_data(self, data_json: str, analysis_type: str) -> str:
        """Run deterministic numerical analysis on data. This uses pure Python
        computation — no LLM.  Always prefer this over computing in prose.

        Args:
            data_json: A JSON array of rows (from execute_query results).
            analysis_type: One of:
                - "total" — sum a numeric column (expects rows with 'amount' or 'total' key)
                - "trend_monthly" — monthly totals (expects 'date' and 'amount'/'debit' columns)
                - "trend_yearly" — yearly totals with year-over-year delta
                - "comparison" — compare two named groups (expects 'group' and 'amount' keys)
                - "top_merchants" — rank by total spend (expects 'description' and 'debit' columns)
                - "summary_stats" — min, max, avg, count of a numeric column
        """
        try:
            rows = json.loads(data_json)
        except json.JSONDecodeError:
            return "ERROR: data_json is not valid JSON."

        if not rows:
            return json.dumps({"result": "No data to analyse."})

        analysis_type = analysis_type.strip().lower()

        if analysis_type == "total":
            return self._analyze_total(rows)
        elif analysis_type == "trend_monthly":
            return self._analyze_trend_monthly(rows)
        elif analysis_type == "trend_yearly":
            return self._analyze_trend_yearly(rows)
        elif analysis_type == "comparison":
            return self._analyze_comparison(rows)
        elif analysis_type == "top_merchants":
            return self._analyze_top_merchants(rows)
        elif analysis_type == "summary_stats":
            return self._analyze_summary(rows)
        else:
            return f"ERROR: Unknown analysis_type '{analysis_type}'. Use: total, trend_monthly, trend_yearly, comparison, top_merchants, summary_stats."

    # -- analysis helpers (all return JSON strings) --------------------------

    @staticmethod
    def _get_amount(row: dict) -> int:
        """Extract amount from a row, trying common column names."""
        for key in ("amount", "total", "debit", "credit", "value", "sum_amount"):
            if key in row and row[key]:
                return int(row[key])
        return 0

    def _analyze_total(self, rows: List[dict]) -> str:
        total = sum(self._get_amount(r) for r in rows)
        return json.dumps({"total": total, "count": len(rows), "currency": "INR"})

    def _analyze_trend_monthly(self, rows: List[dict]) -> str:
        monthly: Dict[str, int] = defaultdict(int)
        for r in rows:
            date_str = r.get("date", "")
            if len(date_str) >= 7:
                month_key = date_str[:7]  # YYYY-MM
            else:
                month_key = "unknown"
            monthly[month_key] += self._get_amount(r)

        sorted_months = sorted(monthly.items())
        trend = []
        prev = None
        for month, amount in sorted_months:
            entry: Dict[str, Any] = {"month": month, "amount": amount}
            if prev is not None:
                delta = amount - prev
                pct = round(delta / prev * 100, 1) if prev != 0 else 0
                entry["change"] = delta
                entry["change_pct"] = pct
            trend.append(entry)
            prev = amount

        return json.dumps({"monthly_trend": trend, "currency": "INR"})

    def _analyze_trend_yearly(self, rows: List[dict]) -> str:
        yearly: Dict[str, int] = defaultdict(int)
        for r in rows:
            date_str = r.get("date", "")
            year = date_str[:4] if len(date_str) >= 4 else "unknown"
            yearly[year] += self._get_amount(r)

        sorted_years = sorted(yearly.items())
        trend = []
        prev = None
        for year, amount in sorted_years:
            entry: Dict[str, Any] = {"year": year, "amount": amount}
            if prev is not None:
                delta = amount - prev
                pct = round(delta / prev * 100, 1) if prev != 0 else 0
                entry["yoy_change"] = delta
                entry["yoy_change_pct"] = pct
            trend.append(entry)
            prev = amount

        return json.dumps({"yearly_trend": trend, "currency": "INR"})

    def _analyze_comparison(self, rows: List[dict]) -> str:
        groups: Dict[str, int] = defaultdict(int)
        for r in rows:
            g = r.get("group", r.get("period", "unknown"))
            groups[str(g)] += self._get_amount(r)

        items = list(groups.items())
        result: Dict[str, Any] = {"groups": dict(items)}
        if len(items) == 2:
            a, b = items[0][1], items[1][1]
            result["difference"] = b - a
            result["change_pct"] = round((b - a) / a * 100, 1) if a != 0 else 0
        return json.dumps(result)

    def _analyze_top_merchants(self, rows: List[dict]) -> str:
        merchants: Dict[str, int] = defaultdict(int)
        for r in rows:
            desc = r.get("description", "unknown")
            merchants[desc] += self._get_amount(r)

        ranked = sorted(merchants.items(), key=lambda x: x[1], reverse=True)
        return json.dumps({
            "ranking": [{"merchant": m, "total": t} for m, t in ranked],
            "currency": "INR",
        })

    def _analyze_summary(self, rows: List[dict]) -> str:
        values = [self._get_amount(r) for r in rows]
        if not values:
            return json.dumps({"error": "No numeric values found."})
        return json.dumps({
            "count": len(values),
            "total": sum(values),
            "min": min(values),
            "max": max(values),
            "average": round(sum(values) / len(values), 2),
            "currency": "INR",
        })

    # =========================================================================
    # TOOL: Get account summary (quick helper)
    # =========================================================================

    @function_tool()
    def get_account_summary(self) -> str:
        """Retrieve a quick summary: savings balance, FDs, and cards.

        Use this for a high-level overview. For detailed queries, use execute_query.
        """
        try:
            balance = self.db.get_balance()
            fds = self.db.execute_read_query(
                "SELECT account_number, principal, tenure, interest_rate, "
                "maturity_date, is_active FROM fixed_deposits WHERE is_active = 1"
            )
            cards = self.db.execute_read_query(
                "SELECT type, last_four, expiry, credit_limit, apr, offers FROM cards"
            )
            return json.dumps({
                "savings_balance": balance,
                "fixed_deposits": fds,
                "cards": cards,
                "currency": "INR",
                "as_of": "2025-04-30",
            })
        except Exception as e:
            return f"ERROR: {e}"

    # =========================================================================
    # TOOL: Create Fixed Deposit
    # =========================================================================

    @function_tool()
    def create_fixed_deposit(self, amount: int, tenure_years: int) -> str:
        """Create a new Fixed Deposit from Savings Account balance.

        Validates available balance, deducts from savings, and creates the FD.
        Interest rate is 7.50% for all tenures.

        Args:
            amount: FD principal amount in rupees. Minimum ₹10,000.
            tenure_years: Tenure in years (1 or 2).
        """
        if amount < 10000:
            return "ERROR: Minimum FD amount is ₹10,000."

        if tenure_years not in (1, 2):
            return "ERROR: Supported tenures are 1 year or 2 years."

        balance = self.db.get_balance()
        if amount > balance:
            return (
                f"ERROR: Insufficient balance. Available: ₹{balance:,}. "
                f"Requested: ₹{amount:,}."
            )

        # Create FD
        rate = 7.50
        today = datetime.now().strftime("%Y-%m-%d")
        maturity_year = datetime.now().year + tenure_years
        maturity_date = datetime.now().replace(year=maturity_year).strftime("%Y-%m-%d")
        tenure_str = f"{tenure_years} Year" + ("s" if tenure_years > 1 else "")
        est_interest = int(amount * rate / 100 * tenure_years)
        maturity_amount = amount + est_interest

        # Generate account number
        fd_count = self.db.execute_read_query(
            "SELECT COUNT(*) AS cnt FROM fixed_deposits"
        )[0]["cnt"]
        fd_acct = f"00{fd_count + 3}-002-500-0{fd_count + 10}"

        self.db.execute_write(
            "INSERT INTO fixed_deposits "
            "(customer_id, account_number, principal, open_date, tenure, "
            "interest_rate, maturity_date, is_active) VALUES (?,?,?,?,?,?,?,?)",
            (1, fd_acct, amount, today, tenure_str, rate, maturity_date, 1),
        )

        # Deduct from savings
        new_balance = balance - amount
        self.db.update_balance(new_balance)

        self.audit.log_banking_action("CREATE_FD", {
            "fd_account": fd_acct,
            "principal": amount,
            "tenure": tenure_str,
            "rate": rate,
            "maturity_date": maturity_date,
        })

        return json.dumps({
            "status": "FD created successfully",
            "fd_account": fd_acct,
            "principal": amount,
            "tenure": tenure_str,
            "interest_rate": rate,
            "estimated_interest": est_interest,
            "maturity_amount": maturity_amount,
            "maturity_date": maturity_date,
            "new_savings_balance": new_balance,
        })

    # =========================================================================
    # TOOL: Break Fixed Deposit
    # =========================================================================

    @function_tool()
    def break_fixed_deposit(self, fd_account: str, amount: int) -> str:
        """Break (partially or fully) a Fixed Deposit and credit Savings.

        A 1% penalty is applied on the broken amount.

        Args:
            fd_account: The FD account number to break from.
            amount: Amount to break in rupees (up to the full principal).
        """
        fds = self.db.execute_read_query(
            f"SELECT id, principal, interest_rate, open_date, is_active "
            f"FROM fixed_deposits WHERE account_number = '{fd_account}' AND is_active = 1"
        )

        if not fds:
            return f"ERROR: No active FD found with account number {fd_account}."

        fd = fds[0]
        if amount > fd["principal"]:
            return (
                f"ERROR: Break amount (₹{amount:,}) exceeds FD principal "
                f"(₹{fd['principal']:,})."
            )

        # 1% penalty
        penalty = int(amount * 0.01)
        credit_amount = amount - penalty

        # Update FD
        new_principal = fd["principal"] - amount
        if new_principal <= 0:
            self.db.execute_write(
                f"UPDATE fixed_deposits SET is_active = 0, principal = 0 "
                f"WHERE id = {fd['id']}"
            )
        else:
            self.db.execute_write(
                f"UPDATE fixed_deposits SET principal = {new_principal} "
                f"WHERE id = {fd['id']}"
            )

        # Credit savings
        balance = self.db.get_balance()
        new_balance = balance + credit_amount
        self.db.update_balance(new_balance)

        self.audit.log_banking_action("BREAK_FD", {
            "fd_account": fd_account,
            "amount_broken": amount,
            "penalty": penalty,
            "credited_to_savings": credit_amount,
        })

        return json.dumps({
            "status": "FD broken successfully",
            "amount_broken": amount,
            "penalty_1_pct": penalty,
            "credited_to_savings": credit_amount,
            "new_savings_balance": new_balance,
            "remaining_fd_principal": new_principal,
        })

    # =========================================================================
    # TOOL: Send TDS Certificate
    # =========================================================================

    @function_tool()
    def send_tds_certificate(self, email: str) -> str:
        """Send TDS certificate for the last Financial Year (FY 2024-25) to
        the given email address.

        Args:
            email: Email address to send the certificate to.
        """
        if "@" not in email or "." not in email:
            return "ERROR: Invalid email address."

        # Mask email for confirmation
        parts = email.split("@")
        masked = parts[0][0] + "***@" + parts[1]

        self.audit.log_banking_action("SEND_TDS_CERTIFICATE", {
            "email_masked": masked,
            "financial_year": "2024-25",
        })

        return json.dumps({
            "status": "TDS certificate for FY 2024-25 has been queued for delivery.",
            "email_masked": masked,
            "note": "It will arrive within 24 hours.",
        })

    # =========================================================================
    # TOOL: Transfer to human agent
    # =========================================================================

    @function_tool()
    async def transfer_to_human_agent(self) -> None:
        """Cold-transfer the call to a human agent.

        Use when:
        - Verification fails twice
        - The customer explicitly asks for a human agent
        - The request is outside your capabilities
        """
        transfer_number = os.getenv("TRANSFER_NUMBER", "+916366821717")
        await self.send_event(
            SDKAgentTransferConversationEvent(
                transfer_call_number=transfer_number,
                transfer_options=TransferOption(
                    type=TransferOptionType.COLD_TRANSFER,
                ),
                on_hold_music="relaxing_sound",
            )
        )
        return None

    # =========================================================================
    # TOOL: End call
    # =========================================================================

    @function_tool()
    async def end_call(self) -> None:
        """End the call gracefully when the customer says goodbye."""
        await self.send_event(SDKAgentEndCallEvent())
        return None
