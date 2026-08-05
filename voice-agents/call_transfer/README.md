# Call transfer (cold, warm, inbound)

Crew voice agents that transfer a live call to a human — **cold** (direct
connect) or **warm** (agent briefs the specialist, then bridges). Works for both
**outbound** and **inbound** calls, on any OpenAI-compatible LLM (OpenAI, a local
Ollama, or your own gateway).

- `cold_transfer.py` — connect the caller straight through.
- `warm_transfer.py` — brief the specialist privately (whisper) + hold music, then bridge.
- `enable_inbound.py` — make the agent reachable by phone (inbound).
- `app.py` — deploy entry point; picks the agent via `TRANSFER_MODE`, greets on pickup.

## Why a transfer "doesn't fire" (read this first)

Two things must both be true, or the transfer silently does nothing:

1. **The LLM has to decide to call `transfer_call`** — and it only does that if
   your **system prompt tells it to.** This is the single most common reason a
   transfer never happens. See the prompt in each example. (If you delegate
   reasoning to your own engine via `CUSTOM_LLM_BASE_URL`, then *that engine* must
   emit the `transfer_call` action — check your logs for the tool call.)
2. **A destination number must be set** (`TRANSFER_CALL_NUMBER`). Without it,
   `transfer_call` logs a warning and returns without transferring.

## Do I need the dashboard?

For a **crew** agent, transfer and inbound are done in **code / via the API** —
no dashboard toggle. You just need an agent to exist and a phone number; each of
those you can set up **either** on the dashboard **or** with the API/CLI:

| Step | Dashboard | API / CLI |
|---|---|---|
| Create the agent | app.smallest.ai → create agent | `client.atoms.agents.create_agent(...)` |
| Enable inbound + assign a number | agent settings → inbound + number | `python enable_inbound.py` (`update_agent(allow_inbound_call=True, telephony_product_id=[...])`) |
| Configure transfer | — (it's in this code) | this sample |

> A **single-prompt** agent (no custom code) is different — there you add the
> `transfer_call` tool on the dashboard or via the `AgentTools` helper.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # then fill it in
```

## Run — outbound

```bash
smallestai agent-crew init --agent-id <YOUR_AGENT_ID>
smallestai agent-crew deploy --entry-point app.py     # then make the build live
# place an outbound call to a phone you'll answer, then ask "transfer me to a specialist"
```

Set `TRANSFER_MODE=cold` or `warm` before deploying. (A `run.sh` helper is
included: `./run.sh deploy` / `./run.sh call +91...` / `./run.sh watch CALL-...`.)

## Run — inbound

Same code, works with cold or warm. After deploying:

```bash
# set INBOUND_PRODUCT_ID in .env to the product id of the number that should ring this agent
python enable_inbound.py
```

Then **dial that number** and ask to be transferred.

## Agent-to-agent transfer

Nothing new — the destination just happens to be **another agent's inbound
number**. An AI receptionist hands off to an AI specialist. Setup:

1. Have a second agent (Agent B) — any agent (single-prompt or crew) — with a
   greeting, `allow_inbound_call=True`, and a phone number assigned (its inbound
   number). Same `enable_inbound.py` idea, or set it on the dashboard.
2. In this agent's `.env`, set `TRANSFER_CALL_NUMBER` to **Agent B's number**.

Now when the caller asks for a specialist, this agent cold/warm-transfers to
Agent B, which answers as the specialist. (Verified live: the transfer creates a
fresh inbound call to Agent B from this agent's number.)

## Cold vs warm

- **Cold** — caller connected straight through to the destination.
- **Warm** — agent calls the destination first, briefs them privately (the
  whisper / `private_handoff_option`), plays hold music to the caller, then bridges.

## Troubleshooting

- **Transfers but caller hears silence:** keep the `speak("please hold …")` before
  the event (both examples do).
- **Transfer never fires:** check the log for `transfer_call requested but
  TRANSFER_CALL_NUMBER is not set`, confirm the system prompt is present, and
  (custom engine) confirm the engine emits the `transfer_call` action.
- **First call right after a deploy is silent:** a known pod warm-up flake — call again.
