# Governed Voice Agent

Add PII redaction, cost caps, and tool authorization to a Smallest AI voice agent using [TealTiger](https://github.com/agentguard-ai/tealtiger) governance.

## What it does

Callers speak sensitive data during voice calls — SSNs, credit card numbers, account numbers. Without governance, this PII flows through the STT → LLM → TTS pipeline unscanned.

This example adds deterministic governance at two points in the voice pipeline:

```
[Caller Speech] → [STT: Pulse] → [Governance: PII scan] → [LLM] → [Governance: output scan] → [TTS: Lightning] → [Caller]
```

**Governance enforced:**
- PII in transcribed speech is redacted before it reaches the LLM
- Per-call cost budget ($2 max) with hard stop
- Only approved tools can be triggered by voice commands
- Rate limiting prevents runaway agent loops

## Prerequisites

- Python >= 3.10
- A Smallest AI API key — [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys)
- An OpenAI API key (for the LLM)

## Setup

```bash
cd voice-agents/governance
cp .env.sample .env
# Add your keys to .env

uv pip install -r requirements.txt
```

## Run

```bash
uv run app.py
```

Then place a call from the [Smallest Platform](https://app.smallest.ai/) dashboard.

## How governance works

| Stage | What happens |
|-------|-------------|
| After STT | Transcribed text is scanned for PII (SSN, credit card, phone, email). Detected PII is replaced with `[REDACTED]` before the LLM sees it. |
| Before tool call | Tool authorization checks if the voice-triggered action is on the allowlist. Unauthorized tools are blocked. |
| Before TTS | LLM response is scanned for accidentally-leaked PII before it's spoken back to the caller. |
| Per-call budget | Cumulative cost (STT + LLM + TTS) is tracked. Call ends gracefully when budget is exceeded. |

## Governance modes

| Mode | Behavior |
|------|----------|
| `ENFORCE` | Block PII, enforce budgets (production) |
| `MONITOR` | Allow all, log violations (testing) |
| `REPORT_ONLY` | Allow all, generate compliance reports |

Change the mode in `app.py`:

```python
engine = TealEngine(policies=[...], mode=PolicyMode.MONITOR)
```

## Compliance use cases

- **HIPAA** — Prevent patient data (SSN, medical IDs) from reaching the LLM or being spoken in responses
- **PCI-DSS** — Redact credit card numbers from call transcripts before processing
- **SOC2** — Structured audit trail of every governance decision per call

## Key properties

- No LLM in the governance path — all PII detection is regex-based
- Under 5ms per evaluation — imperceptible in voice latency
- Runs in-process — no external service calls or API keys for governance
- Decision receipts exportable as JSON for compliance evidence

## Related

- [TealTiger Documentation](https://docs.tealtiger.ai/)
- [TealTiger GitHub](https://github.com/agentguard-ai/tealtiger)
- [Voice Agents Developer Guide](https://docs.smallest.ai/voice-agents/developer-guide)
