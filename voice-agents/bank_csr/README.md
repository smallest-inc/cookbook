# Bank CSR — Voice Banking Agent

A full-featured voice-based Customer Support Representative ("Rekha") for an India-based bank, built with the Atoms SDK.

## What This Demonstrates

| Capability | How |
|---|---|
| **Real database queries** | LLM writes SQL, agent validates & executes against SQLite |
| **Multi-round tool chaining** | Query → Analyse → Respond in a single turn |
| **Deterministic computation** | Totals, trends, comparisons done in pure Python (not LLM) |
| **Identity verification** | Session-based KBA — verify once, persist for the call |
| **Banking actions** | Create/break FDs, send TDS certificates |
| **Audit logging** | BackgroundAgentNode writes every event to an audit table |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  AgentSession                    │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  AuditLogger      │  │  CSRAgent (Rekha)    │  │
│  │  Background Node  │  │  OutputAgentNode     │  │
│  │                   │  │                      │  │
│  │  • Logs events    │  │  • 8 function tools  │  │
│  │  • Logs tool use  │  │  • Multi-round loop  │  │
│  │  • Compliance     │  │  • SQL + analysis    │  │
│  └──────────────────┘  └──────────┬───────────┘  │
│                                   │              │
│                          ┌────────▼────────┐     │
│                          │  SQLite DB      │     │
│                          │  (in-memory)    │     │
│                          │  Seeded per     │     │
│                          │  session        │     │
│                          └─────────────────┘     │
└─────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install

```bash
pip install -e .
```

### 2. Set environment variables

```bash
export OPENAI_API_KEY=sk-...
export SMALLEST_API_KEY=...   # from platform.smallest.ai
```

Or create a `.env` file:

```
OPENAI_API_KEY=sk-...
SMALLEST_API_KEY=...
```

### 3. Run locally

```bash
python app.py
```

The agent starts a WebSocket server on port 8080. Connect via the Smallest platform or `smallestai agent chat`.

### 4. Deploy

```bash
smallestai agent deploy --entry app.py
```

## Example Conversations

### Spending query (multi-round chaining)
> **Customer:** "How much did I spend on Amazon in 2024?"
>
> **Rekha:** *(calls execute_query → analyze_data)* "Your total Amazon spend in calendar year 2024 was approximately three lakh seventy-six thousand rupees across 14 transactions."

### FD creation
> **Customer:** "I want to create a Fixed Deposit for 5 lakhs for 1 year."
>
> **Rekha:** *(verifies identity → validates balance → creates FD)* "Done! I've created an FD of five lakh rupees for one year at seven point five percent. Your estimated maturity amount is five lakh thirty-seven thousand five hundred rupees."

### Trend analysis
> **Customer:** "Compare my Swiggy spend this year vs last year."
>
> **Rekha:** *(query → trend_yearly analysis)* "Your Swiggy spend in 2024 was approximately one lakh twenty thousand rupees. So far in 2025, it's sixty-three thousand rupees through April."

## Files

| File | Description |
|---|---|
| `app.py` | Entry point — AtomsApp + session setup |
| `csr_agent.py` | Rekha (OutputAgentNode) — conversation + 8 tools |
| `audit_logger.py` | AuditLogger (BackgroundAgentNode) — compliance logging |
| `database.py` | SQLite schema, seed data, query helpers |

## Tools

| Tool | Type | Description |
|---|---|---|
| `verify_customer` | Identity | KBA verification (name, DOB, account, city, card) |
| `execute_query` | Data | Run SELECT queries against the banking database |
| `analyze_data` | Compute | Deterministic analysis (totals, trends, comparisons) |
| `get_account_summary` | Data | Quick overview of balances, FDs, cards |
| `create_fixed_deposit` | Action | Create FD from savings balance |
| `break_fixed_deposit` | Action | Break FD with 1% penalty, credit savings |
| `send_tds_certificate` | Action | Email TDS cert for FY 2024-25 |
| `end_call` | Control | Gracefully end the call |
