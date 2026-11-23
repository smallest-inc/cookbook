# Credit Card EMI Agent (Hindi and English, inbound)

An inbound Atoms agent that helps a cardholder turn a recent credit card purchase into EMI, in Hindi, English or a mix of both. This folder is the config and prompt; [`create_agent.py`](../../create_agent.py) one level up creates it in your own organization.

Based on a demo agent built by Yash Ghelani. The names, merchants and amounts here are fictional.

## What It Does

- Explains EMI simply, offers the customer's recent transactions, and reads out tenure, rate and monthly EMI for the one they pick
- Confirms the choice back and records the request; it never claims the conversion is done
- Opens by saying it is an AI assistant, and refuses OTPs, PINs, CVVs and full card numbers
- Speaks with the `zariya` voice on Lightning v3.1 Pro and reasons with Electron
- Post-call metrics for whether a request was recorded, which transaction, which tenure, and any guardrail breach

## Files

| File | What it is |
|------|------------|
| `prompt.md` | The single prompt: identity, EMI rules, the conversation flow, guardrails |
| `agent-config.json` | Voice, language, first message, default variables, the `end_call` tool and post-call metrics |

## Create It in Your Org

From `best-practices/agent-configs/`:

```bash
uv pip install -r requirements.txt
uv run create_agent.py credit-card-emi-hi-en            # dry run, sends nothing
uv run create_agent.py credit-card-emi-hi-en --create   # one new agent in your org
```

See the [folder README](../../README.md) for what `--create` sends. It only ever creates a new agent.

## How to Test

1. Open the new agent in the [Atoms dashboard](https://app.smallest.ai) and start a web call or a chat. The default variables fill in a fictional customer, so you can talk to it straight away.
2. Try the happy path: ask to convert a purchase, pick one, choose a tenure, confirm.
3. Try the edges: change your mind on tenure, ask about a transaction that is not listed, offer your OTP, ask if it is a person, switch between Hindi and English mid-sentence.
4. After the call, check the post-call metrics in the call log.

The agent takes inbound calls. To reach it by phone, attach a number you own to it in the dashboard ([phone numbers](https://docs.smallest.ai/voice-agents/telephony/phone-numbers)).

## Compliance Notes

This is a demo, not a production banking agent. Before you put real customers on it:

- **Disclosure.** The first message says it is an AI assistant, and the prompt has it confirm that whenever asked. Keep both.
- **Caller authentication.** The agent trusts `{{customer_name}}` and the transaction list it is given. In production, authenticate the caller (for example IVR plus registered number) before the call reaches the agent, and pass only that customer's data as variables.
- **No credentials.** It must never ask for or accept an OTP, PIN, CVV, password or full card number. Keep redaction on (`redactionConfig.isEnabled`).
- **No false promises.** It records a request; the bank's own system makes the conversion. Rates, fees and tenures in the prompt are sample values. Replace them with your approved terms and the charges your customers will actually see.
- **Static sample data.** Transactions and rates live in the prompt for the demo. Real data should come from your systems through variables or tools, not be pasted into the prompt.

## Changes From the Source Agent

- The first message and prompt now say the agent is an AI assistant
- Merchant names and staff names are replaced with fictional ones; the pronunciation dictionary keeps only the sample customer name
- The voice model is set to `waves_lightning_v3_1_pro`, since Lightning v3.1 retires on 30 November 2026
- Redaction is on, and post-call metrics are added

## Documentation

- [Agent versioning](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/versioning-lifecycle)
- [Post-call metrics](https://docs.smallest.ai/voice-agents/developer-guide/operate/analytics/call-metrics)
- [Lightning v3.1 Pro](https://docs.smallest.ai/model-cards/text-to-speech/lightning-v-3-1-pro)

## Next Steps

- [loan-collections-hi-en](../loan-collections-hi-en/): the outbound Hindi and English collections agent
- [PATTERNS.md](../../PATTERNS.md): the patterns these agents share
- [analytics](../../../../voice-agents/analytics/): pull call logs and post-call metrics
