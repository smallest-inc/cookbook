# Loan Collections Agent (Hindi and English, outbound)

An outbound Atoms agent that calls a business loan customer whose EMI is 20 or more days past due, in Hindi, English or a mix of both, and works toward a specific payment date. [`create_agent.py`](../../create_agent.py) one level up creates it in your own organization, and [`test_call.py`](../../test_call.py) places a single test call to a number you own.

Based on a demo agent built by Yash Ghelani. The customer, lender and amounts here are fictional.

## What It Does

- Says it is an AI assistant, verifies it is speaking to the customer, and names the lender only after that (or when asked)
- States the overdue amount and charges, hears the reason once, then asks for a payment date no later than `{{max_ptp_date}}`
- Firm and calm: a fixed number of refusal rounds, then a callback or a close; no threats, shaming or invented figures
- Stops when the customer repeats a request to end the call, and only offers callbacks between 8 AM and 7 PM
- Handles third parties, disputes, hardship (illness, bereavement, a wedding in the family), driving, and abuse
- Twelve post-call metrics, including outcome, committed date, refusal rounds and a compliance breach flag
- Speaks with the `zoravar` voice on Lightning v3.1 Pro and reasons with Electron; voicemail detection and redaction are on

## Files

| File | What it is |
|------|------------|
| `prompt.md` | The single prompt: mandate, tone, the minimum-outcome gate, verification, the persistence model, hardship, closings, guardrails, worked examples |
| `agent-config.json` | Voice, language, first message, the fictional call context, the `end_call` tool and post-call metrics |

## Create It in Your Org

From `best-practices/agent-configs/`:

```bash
uv pip install -r requirements.txt
uv run create_agent.py loan-collections-hi-en            # dry run, sends nothing
uv run create_agent.py loan-collections-hi-en --create   # one new agent in your org
```

Place one test call to your own phone:

```bash
uv run test_call.py --to +91XXXXXXXXXX                                  # dry run
uv run test_call.py --to +91XXXXXXXXXX --name "Your name" --i-own-this-number --call
```

`test_call.py` refuses to dial unless all of these hold:

- the agent id comes from `.created_agent_id` in this folder, so it can only call through the agent you created
- the number is in E.164 form and you pass `--i-own-this-number`
- it is between 08:00 and 19:00 in `--timezone` (default `Asia/Kolkata`)

It calls `client.atoms.calls.start_outbound_call(..., test_call="true")` with the fictional call context, and `--name` so the agent greets you by your own name.

## How to Test

1. Open the new agent in the [Atoms dashboard](https://app.smallest.ai) and start a web call or a chat. The default variables give it a full fictional account, so you can play the customer straight away.
2. Then try a phone call with `test_call.py` (above). Outbound calls need a phone number on your account ([phone numbers](https://docs.smallest.ai/voice-agents/telephony/phone-numbers)).
3. Play different customers: one who pays today, one who offers a date past `{{max_ptp_date}}`, one who refuses three times, one who says the loan is not theirs, one who is driving, one who asks twice to stop, one who asks if it is a real person.
4. Check the post-call metrics. `compliance_breach` should be false on every call.

## Compliance Notes

Debt collection in India is regulated. This recipe follows the RBI rules on recovery agents (circular DOR.ORG.REC.65/21.04.158/2022-23, 12 August 2022, carried into the 2025 Responsible Business Conduct Directions). It is a starting point, not legal advice; have your compliance team review the prompt before real calls.

- **Disclosure first.** The first message says it is an AI assistant. The prompt has it confirm that whenever asked and never claim to be human.
- **Call hours.** Calls only between 08:00 and 19:00 in the customer's local time, unless the customer asks for another time. `test_call.py` enforces this; enforce it in your campaign schedule too, and respect any time the customer asks for.
- **No harassment.** No threats of legal action, police, visits, repossession or contacting family or employers; no shaming, no false statements, no invented figures. A repeated request to stop ends the call politely with a callback offer. The `compliance_breach` metric flags any of these.
- **Do-not-call.** The source agent had a DNC override switched on. This recipe does not carry it over, so DND preferences and your own suppression lists apply. Record a DND request (`dnd_requested`) and stop calling that number through your own systems.
- **Call frequency.** Cap how often one customer is called in your campaign settings. Persistent calling counts as harassment under the RBI rules.
- **Sensitive moments.** The prompt backs off for bereavement, illness, a wedding in the family, or someone driving. Avoid calling at such times when you know about them.
- **Privacy.** Account details are shared only after the customer confirms who they are. The agent never asks for an OTP, PIN, CVV, password or full account, Aadhaar or PAN number. Redaction is on.
- **Static sample data.** The call context in `defaultVariables` is fictional and fixed. In production pass each customer's real figures as call variables, and update `{{max_ptp_date}}` and the charges for your own policy.

## Changes From the Source Agent

- AI disclosure in the first message and prompt; the lender is named only after verification or on request
- Callbacks limited to 8 AM to 7 PM unless the customer asks; a repeated request to stop is honoured instead of pressed
- The DNC override is removed; bereavement and weddings are added to hardship
- `compliance_breach` also flags claiming to be human, pressing after two stop requests, and off-hours callbacks
- The voice model is set to `waves_lightning_v3_1_pro`, since Lightning v3.1 retires on 30 November 2026
- Fictional lender, customer number and dates; redaction on; inbound calls off

## Documentation

- [Calling overview](https://docs.smallest.ai/voice-agents/developer-guide/build/calling/overview)
- [Agent versioning](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/versioning-lifecycle)
- [Post-call metrics](https://docs.smallest.ai/voice-agents/developer-guide/operate/analytics/call-metrics)
- [Lightning v3.1 Pro](https://docs.smallest.ai/model-cards/text-to-speech/lightning-v-3-1-pro)

## Next Steps

- [credit-card-emi-hi-en](../credit-card-emi-hi-en/): the inbound Hindi and English EMI agent
- [PATTERNS.md](../../PATTERNS.md): the patterns these agents share
- [campaigns](../../../../voice-agents/campaigns/): run the agent over an audience with outbound campaigns
- [analytics](../../../../voice-agents/analytics/): pull call logs and post-call metrics
