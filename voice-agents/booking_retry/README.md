# Booking Agent With Retries

An outbound booking agent that calls people who asked for an appointment, and calls them again when the first call fails, goes unanswered, or reaches a voicemail greeting. Every attempt and outcome is written to a local ledger.

> **The key pattern.** Retry only when no conversation happened. A call that was unanswered, failed, or hit a voicemail is retried with backoff and a cap. A call where a person talked to the agent is never redialled automatically, whatever the result. The agent's own verdict from post-call analytics decides which case you are in.

## Features

- Retry policy as plain, tested Python (`policy.py`): per-outcome delays, jitter, attempt cap, voicemail cap, 72 hour deadline
- Voicemail aware. Detection is turned on in the agent, and the spoken message carries a marker phrase so the classifier can recognise it
- Calling window in the contact's own timezone. First calls and retries both wait for it
- SQLite ledger with one row per request and per attempt. Safe to stop and restart without double dialling
- Stops for good on `do_not_call` and `wrong_number`, and remembers the number
- Safe by default. `simulate` replays fixtures on a virtual clock and cannot reach a network. Real calls need an explicit flag, an allow list of countries, and consent on every row
- 100+ offline tests, including a socket guard that fails any test that tries to open a connection

## Demo

```bash
uv run booking_retry.py simulate
```

```
id          phone           tries  status  outcome             reason
c001        +*********01        1  done    booked              booked is final
c002        +*********02        3  done    booked              booked is final
c003        +*********03        2  done    declined            declined is final
c004        +*********04        4  done    no_answer           attempt cap reached (4)
c005        +*********05        1  done    do_not_call         do_not_call is final
c006        +*********06        2  done    voicemail           voicemail cap reached (2)

totals: booked=2, declined=1, do_not_call=1, no_answer=1, voicemail=1
```

Six fictional contacts, each with a scripted run of outcomes (`fixtures/scenarios.json`). The full per-attempt timeline prints under the table. Days of retries replay in milliseconds.

## Requirements

Base dependencies are already installed from the root [`requirements.txt`](../../requirements.txt). Additionally:

```bash
uv pip install -r requirements.txt
```

To place real calls you also need:

- `SMALLEST_API_KEY` in your environment or `.env`
- A booking agent. Create one with [`agent/create_agent.py`](./agent/create_agent.py), then paste [`agent/prompt.md`](./agent/prompt.md) into its prompt box
- `ATOMS_AGENT_ID`, `BOOKING_ALLOWED_PREFIXES` (see `.env.sample`)
- A contacts CSV of people who agreed to be called

## Usage

```bash
# 1. See the schedule
uv run booking_retry.py policy

# 2. Watch retries play out. No key, no network
uv run booking_retry.py simulate

# 3. Run the tests. No key, no network
uv run pytest -v

# 4. Create a NEW agent (dry run first), then set ATOMS_AGENT_ID
uv run agent/create_agent.py
uv run agent/create_agent.py --create

# 5. Real calls to people who agreed to them
cp contacts.sample.csv contacts.local.csv   # then replace the rows with your own
uv run booking_retry.py run --contacts contacts.local.csv --i-have-consent --test-call
uv run booking_retry.py run --contacts contacts.local.csv --i-have-consent --watch
uv run booking_retry.py status
```

Start `run` with one number you own, so you hear the agent once before anyone else does.

## How retries work

`booking_retry.py run` reads the contacts file, adds new requests to the ledger, and places every call that is due. With `--watch` it stays running and places retries as they come due. Without it, it handles what is due now and exits, so you can also run it from cron.

| Call result | What it means | What happens |
|---|---|---|
| `no_answer` | It rang and nobody picked up | Retry after 15, then 60, then 180 minutes (+/- 10 percent) |
| Voicemail | Voicemail detection fired and the agent said its end message | Retry after 4 hours, then 24 hours. Stop after 2 voicemails |
| `failed` | Carrier or platform failure | Retry after 2, 4, 8 minutes, doubling, capped at 30 |
| Short call, no verdict | Under 8 seconds and the agent gave no result | Retry like no answer |
| Person hung up at once | Under 8 seconds, disconnect reason `user_hangup` | Final. They did not want the call |
| `booked`, `declined`, `callback_requested` | The agent's verdict | Final |
| `do_not_call`, `wrong_number` | The agent's verdict | Final, and the number is suppressed from now on |
| Long call, no verdict | A person talked but the analytics said nothing useful | Final, `needs_review`. A human checks the transcript |
| `cancelled`, `aborted`, `blocked` | Stopped on purpose or blocked by the platform | Final |
| Call could not start (429, 502-504, no connection) | Nothing was dialled | Retry with the failure backoff |
| Call may or may not have started (timeout, HTTP 500) | Unknown | Final, `needs_review`, so nobody is rung twice |
| Call rejected (HTTP 4xx) | Bad number, archived agent, not allowed | Final |

Limits that apply to every request: 4 attempts in total (the first call plus 3 retries), and a 72 hour deadline measured from the first attempt. Print them any time with `uv run booking_retry.py policy`. All of them are fields on the `Policy` dataclass in `policy.py`.

### How voicemail is recognised

Atoms voicemail detection plays your `endText` and ends the call. The call log then shows a normal `completed` call, so the recipe uses two signals, in this order:

1. The agent's post-call `booking_status` metric. If it says `voicemail`, that wins.
2. The marker phrase `I will try you again later` in what the agent said. It is in the `endText` of [`agent/agent-config.example.json`](./agent/agent-config.example.json), and a test fails if the two drift apart.

If you change the agent's voicemail message, keep the marker phrase in it, or change `VOICEMAIL_MARKER` in `policy.py`.

### Why the ledger matters

Calling a phone twice by accident is the worst failure this code can have. So:

- An attempt row is written before the call is placed. If the process dies, the next start finds an attempt with no call id and marks the request `needs_review` instead of dialling again
- If the process dies after the call id was saved, the next start reads that call's result and continues from there
- Claiming a request is a single atomic update. Two runners cannot both take the same request
- The SDK is told not to retry a call request on its own (`max_retries=0`). Every retry is a decision in `policy.py` and a row in the ledger

## Safety checks

Every row passes `guard.py` before it can reach the dialer. A bad row stops the run with a reason and nothing is dialled.

- Phone numbers must be E.164 (`+14155550123`)
- Names are limited to letters, digits, spaces and `. , ' -`, up to 60 characters, because they go into the agent's prompt. No newlines, braces or quotes
- The service must be one of `consultation`, `checkup`, `follow_up`. Free text from a file never reaches the prompt
- The timezone must be a real IANA name
- `consent` must be `yes` and `consent_source` must say where it came from
- Real calls need `--i-have-consent`, `BOOKING_ALLOWED_PREFIXES`, and a valid 24 character agent id. Numbers outside the allowed country codes are blocked on every attempt, not only the first
- At most 5 real calls per run by default (`--max-calls`, hard limit 100)
- API keys are read from the environment by the SDK and never printed or stored. Logs show only the last two digits of a number, and never a name
- The ledger and your real contacts file are in `.gitignore`

Calling people is regulated where you and they live (TCPA in the US, TRAI rules in India, and others). Follow the rules for your market. This recipe gives you the plumbing. It does not make a call legal.

## The agent

[`agent/prompt.md`](./agent/prompt.md) and [`agent/agent-config.example.json`](./agent/agent-config.example.json) describe a scheduling assistant for a small clinic. It tells the person it is an AI in its first sentence, books one slot, and never asks for payment or health details. The config enables voicemail detection and defines two post-call metrics, `booking_status` and `booked_slot`.

`create_agent.py` only ever creates a new agent. It never edits or deletes an existing one. It does not set the prompt, so paste `prompt.md` into the prompt box and publish.

This recipe records that a person agreed a slot. It does not write to a calendar. To book into Cal.com while the call is live, add the tools from [Appointment Scheduler](../appointment_scheduler/). To act on `booked_slot` after the call, use a [post-call webhook](https://docs.smallest.ai/voice-agents/integrate/webhooks).

## Structure

```
booking_retry/
├── booking_retry.py        # CLI: policy, simulate, run, status
├── policy.py               # outcomes, classifier, backoff, calling window
├── runner.py               # the retry loop and crash recovery
├── dialer.py               # AtomsDialer (live) and ScriptedDialer (fixtures)
├── ledger.py               # SQLite ledger and suppression list
├── guard.py                # input validation and live-call checks
├── report.py               # text report
├── contacts.sample.csv     # six fictional contacts
├── fixtures/scenarios.json # scripted outcomes for `simulate` and tests
├── agent/
│   ├── prompt.md
│   ├── agent-config.example.json
│   └── create_agent.py
└── tests/                  # offline, no key, no network
```

## Recommended Usage

- Appointment confirmations and booking follow-ups where the first call often goes unanswered
- Any outbound agent that should call back politely, with a cap, instead of dialling until someone picks up
- For one-shot calls with no retries, see [Telephony](../telephony/). For large lists with platform-side retries, see [Campaigns](../campaigns/)

## Campaigns or this recipe

[Campaigns](../campaigns/) already offer `max_retries` and `retry_delay` and are the right choice for big lists. This recipe adds what campaigns do not expose in code: a different schedule for voicemail than for no answer, a calling window per contact timezone, a stop on `do_not_call`, and a ledger you own with every attempt in it. Use it when you want that control, or as a reference for what to ask a campaign to do.

## Things to confirm with your account

- Atoms documents these terminal statuses: `completed`, `failed`, `no_answer`, `cancelled`, `aborted`, `blocked`. `busy` is not a documented status, so it is not handled
- The disconnect reason (`user_hangup`, `agent_hangup`, ...) is read from the call log's `disconnectionReason` field when present. If your account does not return it, short calls are retried instead of dropped
- Post-call analytics arrive shortly after the call. The dialer waits up to 90 seconds for them before it classifies the call

## Documentation

- [Voicemail detection](https://atoms-docs.smallest.ai/deep-dive/voicemail-detection/voicemail-detection)
- [Outbound calls and call logs](https://docs.smallest.ai/api-reference/voice-agents/calls/list)
- [Webhooks](https://docs.smallest.ai/voice-agents/integrate/webhooks)
- [Campaigns](https://docs.smallest.ai/voice-agents/developer-guide/build/campaigns/creating-campaigns)

## Next Steps

- [Analytics](../analytics/) for call logs and transcripts across all attempts
- [Appointment Scheduler](../appointment_scheduler/) to write the booking into a calendar
- [Call Transfer](../call_transfer/) to hand a caller to a person
