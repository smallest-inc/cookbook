# Governed Voice Agent

Add PII redaction and per-call limits to a Smallest AI voice agent using [TealTiger](https://github.com/agentguard-ai/tealtiger) guardrails.

## What it does

Callers say sensitive things during voice calls: SSNs, card numbers, account numbers. Without a guardrail, that text flows through the STT, LLM and TTS pipeline unscanned.

This example scans text at three points in the pipeline:

```
[Caller speech] -> [STT: Pulse] -> [PII scan] -> [LLM + tools] -> [PII scan of tool results] -> [PII scan of reply] -> [TTS: Lightning] -> [Caller]
```

**What is enforced:**
- PII in the caller's transcribed turn is redacted in the conversation context before the LLM sees it.
- Tool results are scanned and redacted before they go back to the LLM.
- The LLM's reply is buffered and scanned before it is spoken, so leaked PII is redacted instead of read out.
- A 20-turn cap per call (`MAX_TURNS_PER_CALL`) ends runaway sessions with a polite goodbye.
- At most 3 chained tool rounds per turn (`MAX_TOOL_ROUNDS`), so a tool loop cannot spin forever.

## Tools

The agent node registers three tools with `@function_tool` and passes their schemas to the LLM on every turn:

| Tool | What it does |
|------|-------------|
| `lookup_account(account_id)` | Returns a stub account record |
| `check_balance(account_id)` | Returns a stub balance |
| `transfer_to_human(reason)` | Cold-transfers the call to `TRANSFER_NUMBER`. If `TRANSFER_NUMBER` is not set, it tells the LLM to say a person will follow up instead of promising a live transfer. |

The stubs keep the example self-contained. Replace them with your own systems.

## Prerequisites

- Python 3.10 or later
- A Smallest AI API key from [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys)
- An OpenAI API key (for the LLM)

## Setup

```bash
cd voice-agents/governance
cp .env.sample .env
# Add your keys to .env. TRANSFER_NUMBER is optional.

uv pip install -r requirements.txt
```

## Run

```bash
uv run app.py
```

Then connect with `smallestai agent-crew chat`, or place a call from the [Smallest Platform](https://app.smallest.ai/) dashboard.

## How it works

| Stage | What happens |
|-------|-------------|
| Caller turn | `redact()` runs TealTiger's `PIIDetectionGuardrail` on the latest user message and replaces each detection with `[TYPE REDACTED]` in the context. |
| LLM call | `generate_response()` calls the LLM with `tools=self.tool_schemas`. If it asks for tools, the registry runs them, the redacted results are added to the context, and the LLM is called again. |
| Before TTS | The final reply is scanned with the same guardrail. Only the redacted text is spoken and stored in the context. |
| Turn cap | After 20 turns the agent ends the conversation politely. |

Change the limits at the top of `app.py`:

```python
MAX_TURNS_PER_CALL = 20
MAX_TOOL_ROUNDS = 3
```

## Notes

- PII detection is done in-process by TealTiger. It does not call an external service.
- The reply is buffered so it can be scanned, which adds the LLM's full generation time before the agent starts speaking. Streaming sentence by sentence with a per-sentence scan is a possible extension.
- Redaction only covers the patterns TealTiger detects. Test it with the kinds of data your callers actually say.

## Related

- [TealTiger documentation](https://docs.tealtiger.ai/)
- [TealTiger on GitHub](https://github.com/agentguard-ai/tealtiger)
- [Voice Agents developer guide](https://docs.smallest.ai/voice-agents/developer-guide)
