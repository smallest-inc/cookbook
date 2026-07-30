# 🏦 Bank CSR — AI Voice Banking Agent

A production-grade voice-based Customer Support Representative (**"Rekha"**) for an India-based bank, built with the [Atoms SDK](https://docs.smallest.ai). Rekha handles identity verification, live SQL queries against a real database, deterministic number-crunching, banking actions (FD creation/breaking, TDS certificates), compliance audit logging, and call transfers — all over a phone call.

> **"How much did I spend on Amazon in the last 2 years, and how is it trending?"**
>
> Rekha doesn't hallucinate an answer. She writes a SQL query, executes it against a real database, runs a deterministic Python computation on the results, and *then* speaks the answer — with amounts in the Indian numbering system (lakh, crore).

---

## Features

| Feature | Description |
|---------|-------------|
| **Real database queries** | LLM writes SQL → agent validates & executes against an in-memory SQLite database |
| **Multi-round tool chaining** | `execute_query` → `analyze_data` → spoken response, all in a single conversational turn |
| **Deterministic computation** | Totals, trends, comparisons, rankings done in pure Python — no LLM math hallucinations |
| **Session-based identity verification** | KBA with 2 factors (Level 1) or 3 factors (Level 2). Verify once, never re-ask |
| **Banking actions** | Create/break Fixed Deposits, send TDS certificates — with balance validation and penalty calculation |
| **Compliance audit logging** | Silent `BackgroundCrewNode` writes every event, tool call, and action to an audit table |
| **Cold & warm call transfers** | Immediate handoff or brief-the-supervisor-first escalation, with hold music |
| **India-specific voice behaviour** | Amounts in lakh/crore, digits read one-at-a-time, secure handling of PINs/OTPs/CVVs |

---

## Demo

Here's what a typical call flow looks like:

```
Rekha:  Namaste! Welcome to Smallest Bank. I'm Rekha, your customer
        support representative. How may I help you today?

You:    Hi Rekha, I want to check my account balance.

Rekha:  Sure, I'll need to verify your identity first. Could you please
        share your full name and date of birth?

You:    Ajay Kumar, 15th February 1988.

Rekha:  Thank you, Mr. Kumar. Your identity has been verified.
        Your savings account ending zero zero zero four has an available
        balance of eight lakh twenty thousand two hundred and one rupees,
        as of April 30th, 2025.

You:    How much did I spend on Amazon since January 2024?

        ┌──────────────────────────────────────────────────────────┐
        │ Tool chain (behind the scenes):                          │
        │  1. execute_query → SELECT date, debit FROM transactions │
        │     WHERE description LIKE '%Amazon%'                    │
        │     AND date >= '2024-01-01'                             │
        │  2. analyze_data(results, "total")                       │
        │     → {"total": 519000, "count": 17, "currency": "INR"} │
        └──────────────────────────────────────────────────────────┘

Rekha:  Your total Amazon spend since January 2024 is five lakh nineteen
        thousand rupees across 17 transactions.

You:    Break that down by year.

        ┌──────────────────────────────────────────────────────────┐
        │ Tool chain:                                              │
        │  1. execute_query → same query with date grouping        │
        │  2. analyze_data(results, "trend_yearly")                │
        │     → 2024: ₹3,76,000  |  2025: ₹1,43,000              │
        └──────────────────────────────────────────────────────────┘

Rekha:  In calendar year 2024, you spent three lakh seventy-six thousand
        rupees on Amazon. So far in 2025 through April, it's one lakh
        forty-three thousand rupees.

You:    Create an FD of 2 lakhs for 1 year.

Rekha:  For this action I'll need one more verification factor. Could you
        share the last 4 digits of your savings account number?

You:    Zero zero zero four.

Rekha:  Verified. I'll create a Fixed Deposit of two lakh rupees for one
        year at seven point five percent. Estimated interest is fifteen
        thousand rupees, maturity amount two lakh fifteen thousand. Shall
        I proceed?

You:    Yes.

Rekha:  Done! Your FD has been created. Your new savings balance is six
        lakh twenty thousand two hundred and one rupees.

You:    I want to speak to a supervisor about my credit limit.

Rekha:  I'll brief my supervisor and connect you right away.
        [Warm transfer → supervisor receives context → hold music plays]
```

---

## Requirements

- Python ≥ 3.12
- An [OpenAI API key](https://platform.openai.com/api-keys) (GPT-4o)
- A [Smallest AI API key](https://app.smallest.ai) (for deployment)

### Dependencies

Only one direct dependency — the Atoms SDK bundles everything else:

```
smallestai >= 5.3.1
```

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

---

## Usage

### 1. Install

```bash
uv pip install -r voice-agents/bank_csr/requirements.txt
```

### 2. Set environment variables

```bash
export OPENAI_API_KEY=sk-...
export SMALLEST_API_KEY=...        # from app.smallest.ai
export TRANSFER_NUMBER=+91...      # optional: phone number for call transfers
```

Or create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
SMALLEST_API_KEY=...
TRANSFER_NUMBER=+916366821717
```

### 3. Run locally

```bash
uv run voice-agents/bank_csr/app.py
```

Starts a WebSocket server on `localhost:8080`.

### 4. Test via CLI

```bash
smallestai agent-crew chat
```

### 5. Deploy to Smallest Platform

```bash
smallestai agent-crew deploy --entry app.py
```

Then make a call from the [Smallest Platform](https://app.smallest.ai) dashboard.

---

## When to Use This

✅ **Use this example when you need to:**
- Build a voice agent that queries a real database (SQL) instead of hardcoding answers
- Chain multiple tool calls in a single turn (query → compute → respond)
- Perform deterministic computation (totals, trends) without relying on LLM arithmetic
- Implement session-based identity verification with escalation levels
- Add silent compliance/audit logging alongside a conversational agent
- Handle banking or financial actions with validation and state changes
- Support both cold and warm call transfers

❌ **This is NOT the right example if you:**
- Just need a simple Q&A chatbot → see [`getting_started`](../getting_started)
- Only need basic tool calling → see [`agent_with_tools`](../agent_with_tools)
- Only need call transfer/end call → see [`call_control`](../call_control)
- Need a background processing node without the full banking stack → see [`background_agent`](../background_agent)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CrewSession                                 │
│                                                                      │
│  ┌─────────────────────┐     ┌────────────────────────────────────┐  │
│  │  AuditLogger         │     │  CSRAgent (Rekha)                  │  │
│  │  BackgroundCrewNode  │     │  OutputCrewNode                   │  │
│  │                       │     │                                    │  │
│  │  • Logs call start    │     │  • 10 function tools               │  │
│  │  • Logs transcripts   │     │  • Multi-round generate_response   │  │
│  │  • Logs tool calls    │     │  • OpenAI GPT-4o (streaming)       │  │
│  │  • Logs verifications │     │  • Session-based verification      │  │
│  │  • Logs banking acts  │     │  • SQL query + analysis pipeline   │  │
│  │  • Session summary    │     │  • Cold & warm call transfers      │  │
│  └──────────┬────────────┘     └──────────────┬─────────────────────┘  │
│             │                                 │                      │
│             └──────────┬──────────────────────┘                      │
│                        │                                             │
│               ┌────────▼────────┐                                    │
│               │   SQLite DB     │                                    │
│               │   (in-memory)   │                                    │
│               │                 │                                    │
│               │  • customers    │                                    │
│               │  • accounts     │                                    │
│               │  • transactions │                                    │
│               │  • fixed_deps   │                                    │
│               │  • cards        │                                    │
│               │  • audit_log    │                                    │
│               └─────────────────┘                                    │
└──────────────────────────────────────────────────────────────────────┘
```

Both nodes receive the same event stream. The `AuditLogger` silently observes and logs; the `CSRAgent` handles the conversation.

---

## Files

| File | Lines | Description |
|------|-------|-------------|
| `app.py` | ~66 | Entry point — creates `BankingDB`, wires `AuditLogger` + `CSRAgent`, handles greeting |
| `csr_agent.py` | ~751 | Rekha (`OutputCrewNode`) — system prompt, `generate_response`, all 10 tools |
| `audit_logger.py` | ~108 | `AuditLogger` (`BackgroundCrewNode`) — compliance event logging |
| `database.py` | ~463 | SQLite schema, seed data (1 customer, 75+ transactions), query helpers |
| `requirements.txt` | ~2 | Dependencies |

---

## Tools

| # | Tool | Category | Description |
|---|------|----------|-------------|
| 1 | `verify_customer` | Identity | KBA with up to 5 factors (name, DOB, account last 4, city, debit card last 4). Level 1 = 2 factors, Level 2 = 3 factors. |
| 2 | `execute_query` | Data | Run a read-only `SELECT` query against the banking SQLite DB. Dangerous keywords blocked. |
| 3 | `analyze_data` | Compute | Deterministic Python analysis: `total`, `trend_monthly`, `trend_yearly`, `comparison`, `top_merchants`, `summary_stats` |
| 4 | `get_account_summary` | Data | Quick overview: savings balance, active FDs, cards |
| 5 | `create_fixed_deposit` | Action | Create FD from savings. Validates balance, minimum ₹10,000, 1 or 2 year tenure, 7.5% rate |
| 6 | `break_fixed_deposit` | Action | Break FD (partial or full). 1% penalty, credits savings |
| 7 | `send_tds_certificate` | Action | Queue TDS certificate for FY 2024-25 to an email address |
| 8 | `transfer_to_human_agent` | Call Control | Cold transfer — immediate handoff with relaxing hold music |
| 9 | `warm_transfer_to_supervisor` | Call Control | Warm transfer — briefs supervisor with context, uplifting hold music |
| 10 | `end_call` | Call Control | Gracefully end the call |

---

## How It Works

### 1. Session Setup (`app.py`)

Two nodes run in parallel inside a single `CrewSession`:

```python
db = BankingDB()

audit = AuditLogger(db=db)        # BackgroundCrewNode — silent logging
session.add_node(audit)

csr = CSRAgent(db=db, audit=audit) # OutputCrewNode — conversation
session.add_node(csr)

await session.start()
```

### 2. Multi-Round Tool Chaining (`csr_agent.py`)

The core of the agent is a `generate_response` loop that keeps calling tools until the LLM produces a final text response:

```python
async def generate_response(self):
    MAX_ROUNDS = 5

    for _round in range(MAX_ROUNDS):
        response = await self.llm.chat(
            messages=self.context.messages,
            stream=True,
            tools=self.tool_schemas,
        )

        tool_calls = []
        full_response = ""

        async for chunk in response:
            if chunk.content:
                full_response += chunk.content
                yield chunk.content          # stream text to TTS
            if chunk.tool_calls:
                tool_calls.extend(chunk.tool_calls)

        if not tool_calls:
            # No tools called → final answer
            return

        # Execute tools, add results to context, loop again
        results = await self.tool_registry.execute(
            tool_calls=tool_calls, parallel=True
        )
        # ... append tool messages to context ...
```

This enables chains like:

```
User: "How much did I spend on Amazon, and is it trending up?"

Round 1: LLM calls execute_query(sql="SELECT date, debit FROM transactions WHERE ...")
Round 2: LLM calls analyze_data(data_json=<query results>, analysis_type="trend_yearly")
Round 3: LLM produces spoken response using the computed trend data
```

### 3. Deterministic Analysis (`analyze_data`)

All number-crunching is done in pure Python — the LLM never does arithmetic:

```python
@function_tool()
def analyze_data(self, data_json: str, analysis_type: str) -> Any:
    rows = json.loads(data_json)

    if analysis_type == "total":
        total = sum(self._get_amount(r) for r in rows)
        return {"total": total, "count": len(rows), "currency": "INR"}

    elif analysis_type == "trend_yearly":
        # Group by year, compute YoY deltas and percentages
        ...

    elif analysis_type == "top_merchants":
        # Rank merchants by total spend
        ...
```

Available analysis types: `total`, `trend_monthly`, `trend_yearly`, `comparison`, `top_merchants`, `summary_stats`

### 4. Identity Verification (`verify_customer`)

Verification happens against the live database, not hardcoded values:

```python
@function_tool()
def verify_customer(self, name="", dob="", account_last_four="", city="", debit_card_last_four=""):
    # Fetch ground truth from DB
    row = self.db.execute_read_query(
        "SELECT c.name, c.dob, c.city, a.account_number, ca.last_four "
        "FROM customers c JOIN accounts a ... JOIN cards ca ..."
    )
    # Compare each provided factor against DB
    # Level 1 (2 factors) → account info access
    # Level 2 (3 factors) → banking actions allowed
```

Once verified, `self.is_verified = True` persists for the entire session — no re-asking.

### 5. Audit Logging (`audit_logger.py`)

The `AuditLogger` is a `BackgroundCrewNode` that runs silently alongside the main agent:

```python
class AuditLogger(BackgroundCrewNode):
    async def process_event(self, event: SDKEvent):
        if isinstance(event, SDKSystemUserJoinedEvent):
            self.db.log_audit("CALL_START", ...)
        elif isinstance(event, SDKAgentTranscriptUpdateEvent):
            self.db.log_audit("TRANSCRIPT", ...)

    def log_tool_call(self, tool_name, args, result):
        self.db.log_audit("TOOL_CALL", ...)

    def log_banking_action(self, action, details):
        self.db.log_audit("BANKING_ACTION", ...)
```

At session end, a compliance summary is logged:

```json
{
    "call_start": "2025-04-30T10:15:00",
    "total_events": 12,
    "transcript_turns": 8,
    "tool_invocations": 5,
    "banking_actions": 1,
    "verification_attempts": 1
}
```

### 6. Call Transfers

**Cold transfer** — immediate handoff:

```python
@function_tool()
async def transfer_to_human_agent(self) -> None:
    await self.send_event(
        SDKAgentTransferConversationEvent(
            transfer_call_number=os.getenv("TRANSFER_NUMBER"),
            transfer_options=TransferOption(type=TransferOptionType.COLD_TRANSFER),
            on_hold_music="relaxing_sound",
        )
    )
```

**Warm transfer** — brief the supervisor first:

```python
@function_tool()
async def warm_transfer_to_supervisor(self, reason: str) -> None:
    await self.send_event(
        SDKAgentTransferConversationEvent(
            transfer_call_number=os.getenv("TRANSFER_NUMBER"),
            transfer_options=TransferOption(
                type=TransferOptionType.WARM_TRANSFER,
                private_handoff_option=WarmTransferPrivateHandoffOption(
                    type=WarmTransferHandoffOptionType.PROMPT,
                    prompt=f"Customer escalation at Smallest Bank: {reason}",
                ),
            ),
            on_hold_music="uplifting_beats",
        )
    )
```

### 7. Extending to External Observability

The `AuditLogger` writes to SQLite by default, but the `BackgroundCrewNode` pattern makes it trivial to stream events to any external observability platform — **without changing the main agent at all**.

Because the background node runs in parallel and never blocks the conversation, you get real-time visibility into live transcription, tool calls, and banking actions with zero impact on latency.

Replace or extend the logging calls in `audit_logger.py`:

```python
# Instead of (or in addition to) SQLite:
self.db.log_audit("TOOL_CALL", ...)

# Stream to Langfuse:
self._trace.span(name=f"tool:{tool_name}", input=args, output=result)

# Or Datadog, LangSmith, etc:
self.dd_client.send_event(name="tool_call", tags={"tool": tool_name})
```

The key insight: the `BackgroundCrewNode` receives the **exact same event stream** as the main agent — transcript updates, tool calls, user join/leave, everything. Swapping the sink from SQLite to Langfuse (or any platform) is a one-file change.

> **See the [`observability`](../observability) cookbook for a full working integration with [Langfuse](https://langfuse.com)** — live traces, tool call spans, transcript events, and session summaries streaming in real-time.

---

## Database Schema

The agent queries a real SQLite database with these tables:

| Table | Key Columns | Records |
|-------|-------------|---------|
| `customers` | name, dob, city, cibil_score, address | 1 customer (Ajay Kumar) |
| `accounts` | account_number, balance, currency | 1 savings account |
| `fixed_deposits` | principal, interest_rate, tenure, maturity_date, is_active | 2 active FDs |
| `cards` | type (debit/credit), last_four, credit_limit, apr | 2 cards |
| `transactions` | date, description, debit, credit, balance | 75+ transactions (Jan 2024 – Apr 2025) |
| `audit_log` | timestamp, event_type, details | Written by AuditLogger at runtime |

### Precomputed Totals (for verification)

These are what the database will return — the agent computes them live, nothing is hardcoded:

| Query | Result |
|-------|--------|
| Savings balance | ₹8,20,201 |
| Amazon spend (calendar 2024) | ₹3,76,000 |
| Amazon spend (since Jan 2024) | ₹5,19,000 |
| Swiggy spend (since Jan 2024) | ₹1,71,800 |
| Adani Electricity (since Jan 2024) | ₹2,37,000 |
| Uber (since Jan 2024) | ₹19,000 |
| Adani + Uber combined | ₹2,56,000 |
| Credits to Jyoti Kumar | ₹6,00,000 |
| Dividend income | ₹11,10,000 |
| Municipal tax paid | ₹1,20,000 |
| Total FD principal | ₹35,00,000 |

---

## Customer Test Data

Use these details when testing identity verification:

| Factor | Value | How to say it |
|--------|-------|---------------|
| Name | Ajay Kumar | "Ajay Kumar" |
| Date of birth | 1988-02-15 | "Fifteenth February nineteen eighty-eight" |
| City | Mumbai | "Mumbai" |
| Account last 4 | 0004 | "Zero zero zero four" |
| Debit card last 4 | 0437 | "Zero four three seven" |

**Level 1** (balance/spend queries) — any 2 factors.
**Level 2** (FD create/break, TDS) — any 3 factors.

---

## Example Conversations

### Spending query with tool chaining

```
You:    How much did I spend on Amazon in 2024?
Rekha:  [execute_query → analyze_data("total")]
        Your total Amazon spend in calendar year 2024 was approximately
        three lakh seventy-six thousand rupees across 13 transactions.
```

### Year-over-year comparison

```
You:    How does my Amazon spend compare between 2024 and 2025?
Rekha:  [execute_query → analyze_data("trend_yearly")]
        In 2024, you spent three lakh seventy-six thousand rupees on Amazon.
        So far in 2025 through April, it's one lakh forty-three thousand rupees.
```

### FD creation

```
You:    Create an FD for 5 lakhs, 1 year.
Rekha:  [verify_customer(Level 2) → create_fixed_deposit(500000, 1)]
        Done! FD of five lakh rupees created for one year at seven point five
        percent. Estimated maturity: five lakh thirty-seven thousand five hundred
        rupees. Your new savings balance is three lakh twenty thousand rupees.
```

### FD break with penalty

```
You:    Break one lakh from my FD ending zero zero zero seven.
Rekha:  [break_fixed_deposit("003-002-500-007", 100000)]
        Breaking one lakh rupees from FD ending zero zero zero seven.
        A one percent penalty of one thousand rupees applies.
        Ninety-nine thousand rupees will be credited to your savings.
        Shall I proceed?
```

### Warm transfer escalation

```
You:    I want to speak to your supervisor about my credit limit.
Rekha:  [warm_transfer_to_supervisor("credit limit inquiry")]
        I'll brief my supervisor and connect you right away.
        [Supervisor receives: "Customer escalation: credit limit inquiry"]
        [Customer hears uplifting beats hold music]
```

---

## API Reference

This example uses the following Atoms SDK components:

| Component | Import | Purpose |
|-----------|--------|---------|
| `AtomsCrewApp` | `smallestai.atoms.crew.server` | WebSocket server + session lifecycle |
| `CrewSession` | `smallestai.atoms.crew.session` | Session management, node graph |
| `OutputCrewNode` | `smallestai.atoms.crew.nodes` | Conversational agent with TTS output |
| `BackgroundCrewNode` | `smallestai.atoms.crew.nodes` | Silent parallel processing node |
| `OpenAIClient` | `smallestai.atoms.crew.clients.openai` | Streaming LLM client |
| `ToolRegistry` | `smallestai.atoms.crew.tools` | Tool discovery, schema generation, execution |
| `@function_tool` | `smallestai.atoms.crew.tools` | Decorator to register tools from methods |
| `SDKAgentTransferConversationEvent` | `smallestai.atoms.crew.events` | Cold/warm call transfers |
| `SDKAgentEndCallEvent` | `smallestai.atoms.crew.events` | End call |
| `SDKSystemUserJoinedEvent` | `smallestai.atoms.crew.events` | User joined trigger |

Full SDK docs: [docs.smallest.ai](https://docs.smallest.ai)

---

## Next Steps

- **Simpler starting point** → [`getting_started`](../getting_started) — basic agent with no tools
- **Just tool calling** → [`agent_with_tools`](../agent_with_tools) — single-round tool usage
- **Call control only** → [`call_control`](../call_control) — transfers and end call
- **Background processing** → [`background_agent`](../background_agent) — sentiment analysis node
- **Observability with Langfuse** → [`observability`](../observability) — stream live traces, tool calls, and transcripts to Langfuse
- **Interrupt control** → [`interrupt_control`](../interrupt_control) — mute/unmute user
- **Language switching** → [`language_switching`](../language_switching) — multi-language support
- **Swap the database** → Replace `BankingDB` with a real PostgreSQL/MySQL connection for production
- **Add more analysis types** → Extend `analyze_data` with forecasting, anomaly detection, etc.
- **Multi-customer support** → Use `session_context.initial_variables` to pass the customer ID at call start
