# Telephony: Inbound and Outbound

Rent a phone number, attach it to a crew agent, and take inbound calls or place outbound calls. The same crew code (`server.py` + `assistant.py`) handles both directions. No code change needed between inbound and outbound.

## Features

- **`phone_numbers.search_rentable`.** Find numbers available from Plivo or Twilio.
- **`phone_numbers.rent`.** Rent a specific number.
- **`agents.update_agent`.** Attach a rented number and toggle inbound.
- **`calls.start_outbound_call`.** Place an outbound call from the agent.
- **Same crew code for both directions.** `OutputCrewNode.generate_response()` runs inbound + outbound.

## Demo

**Inbound.** Rent a number, attach it with `allow_inbound_call=True`, then dial the number from any phone. The crew answers with the same LLM turn logic your `assistant.py` defines.

**Outbound.** Attach a number to the agent, then call `start_outbound_call(agent_id, phone_number, from_product_id=<rented number's product id>)`. The crew places the call and speaks first.

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

Env vars in `.env`:

```
SMALLEST_API_KEY=sk_...
OPENAI_API_KEY=sk-...
ATOMS_AGENT_ID=<your agent id>
```

Get the agent ID from the dashboard or from `smallestai agents create "cookbook-telephony"`.

## Usage

### 1. Rent a number and attach it

```bash
uv pip install -r requirements.txt
uv run provision.py --country IN --provider plivo
```

`provision.py` walks the four-step flow.

1. Searches Plivo (or Twilio) inventory for `IN` numbers.
2. Rents the first candidate.
3. Attaches the rented product ID to the agent via `update_agent`.
4. Prints the rented number and product ID so you can call it (inbound) or reference it (outbound).

### 2. Bring the crew up

```bash
uv run server.py
```

`ws://localhost:8080/ws` is the crew endpoint. Once deployed via `smallestai agent-crew deploy` + Make Live, the platform routes inbound calls on the attached number to this crew.

### 3. Test inbound

Dial the rented number from any phone. The crew answers with your `assistant.py` logic.

### 4. Place an outbound call

```bash
uv run outbound.py --to +1415551234
```

`outbound.py` calls `calls.start_outbound_call(agent_id, phone_number=to, from_product_id=...)`. The crew dials out and speaks first when the callee picks up.

## Key Snippets

### Rent + attach (`provision.py`)

```python
from smallestai import SmallestAI

client = SmallestAI()  # reads SMALLEST_API_KEY

# 1. Search
candidates = client.atoms.phone_numbers.search_rentable(
    country_code="IN",
    provider="plivo",
).data

# 2. Rent the first one
target = candidates[0].phone_number
rented = client.atoms.phone_numbers.rent(
    phone_number=target,
    provider="plivo",
).data

product_id = rented.product_id  # attach this to the agent

# 3. Attach to the agent and enable inbound
client.atoms.agents.update_agent(
    id=AGENT_ID,
    telephony_product_id=[product_id],
    allow_inbound_call=True,
)
```

### Outbound call (`outbound.py`)

```python
resp = client.atoms.calls.start_outbound_call(
    agent_id=AGENT_ID,
    phone_number="+14155551234",     # destination
    from_product_id=product_id,      # the number rented above
).data

print(resp.call_id)                  # track with client.atoms.calls.get(id=call_id)
```

### The crew (unchanged, `server.py` + `assistant.py`)

```python
class Assistant(OutputCrewNode):
    async def generate_response(self):
        response = await self.llm.chat(messages=self.context.messages, stream=True)
        async for chunk in response:
            if chunk.content:
                yield chunk.content
```

## Recommended Usage

- Any voice agent that needs a real phone number.
- Inbound + outbound in one deploy. One crew, one build, both directions.
- For campaign-style bulk outbound, see [Campaigns](../campaigns/).

## Gotchas

- **Warm-up on the first call after Make Live.** A newly-promoted build takes a few seconds to warm up. The first inbound or outbound call after `agent-crew builds → Make Live` may be silent or drop. Retry once; subsequent calls answer normally.
- **Provider choice matters for country coverage.** `plivo` vs `twilio` inventories differ by country. Search both if the first returns empty.
- **`allow_inbound_call` is per-agent, not per-number.** Toggling it off means every attached number stops taking inbound. Numbers stay attached; they just don't route.
- **`from_product_id` on outbound is optional but recommended.** Omit it to use the agent's default assigned number. Pass it explicitly when the agent has multiple numbers attached.
- **`start_outbound_call` returns as soon as the call is queued.** Poll `client.atoms.calls.get(id=call_id)` for status.

## Common Snags

- `phone_numbers.search_rentable` returned an empty list → try the other provider (`twilio` vs `plivo`) or a different `country_code` / `area_code`.
- Inbound call rings but no audio → check the build is live in `smallestai agent-crew builds`, and that `allow_inbound_call=True` on the agent.
- Outbound errors with "no phone number" → the agent hasn't been attached to a product yet. Re-run `provision.py` or attach via the dashboard.
