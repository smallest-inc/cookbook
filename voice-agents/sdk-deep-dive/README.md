# SDK deep dive

A single, ordered path through the Smallest voice-agent SDK. Start here, follow the
steps in order, and you will have built, deployed, and called a production-shaped agent,
including a deterministic multi-agent workflow.

Every step links to a runnable example in this cookbook and to the matching page in the
[developer guide](https://docs.smallest.ai/voice-agents/developer-guide).

## What you build

You write the LLM turn as a small piece of code (a crew node). The platform handles
speech to text, text to speech, voice, telephony, recording, redaction, and post-call
analytics as agent config. You bring the brain, the platform is the body around it.

## Prerequisites

- Python 3.10+
- `pip install smallestai`
- `SMALLEST_API_KEY` from https://app.smallest.ai/dashboard/api-keys
- An LLM key if you bring your own model (for example `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

## The deploy loop, once

An agent is created first, then your code is linked to it and deployed. Deploy does not
create the agent.

```bash
pip install smallestai
smallestai auth login

# create the agent (or make one on the dashboard). prints the agent id to use below
python -c "from smallestai import SmallestAI; print(SmallestAI().atoms.agents.create_agent(name='my-agent').data)"

smallestai agent-crew init --agent-id <agent-id>
smallestai agent-crew deploy --entry-point server.py
smallestai agent-crew builds          # pick the build, Make Live
```

Iterate locally without deploying:

```bash
python server.py                       # boots ws://localhost:8080/ws
smallestai agent-crew chat             # in a second terminal, talk to it
```

## The path

1. **Quickstart.** Your first agent. `OutputCrewNode`, `generate_response`, `AtomsCrewApp`.
   [getting_started](../getting_started/) ·
   [docs](https://docs.smallest.ai/voice-agents/developer-guide/get-started/quickstart)
2. **Bring your own model.** Point the node at any OpenAI-compatible endpoint.
   [byom](../byom/) ·
   [docs](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/llm/byom)
3. **Tools.** Register functions the LLM can call, with `@function_tool`.
   [agent_with_tools](../agent_with_tools/) ·
   [docs](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/tools/defining-tools)
4. **A compliance guard.** A rule the agent cannot skip, enforced in code.
   [compliance_guard](./compliance_guard/)
5. **Deploy, call, and watch.** Make the build live, place a call, stream the events.
   [deploy and watch](#deploy-call-and-watch) below ·
   [docs](https://docs.smallest.ai/voice-agents/developer-guide/get-started/agents-cli)
6. **Transfer to a human.** Warm and cold transfer.
   [call_transfer](../call_transfer/) ·
   [docs](https://docs.smallest.ai/voice-agents/developer-guide/build/calling/call-transfer)
7. **Deterministic multi-agent.** Multiple sub-agents, data-dependent transitions, skip a
   step based on data, all decided in your code.
   [multi_agent_deterministic](./multi_agent_deterministic/)
8. **The platform API path, no crew.** Create agents, run outbound and campaigns, read
   call logs and analytics from code.
   [campaigns](../campaigns/) · [analytics](../analytics/)

## crew or platform API, which to use

| You want | Use |
|---|---|
| Your own LLM, tools, guards, and turn logic in code | crew (steps 1 to 7) |
| Create agents, outbound calls, campaigns, call logs, analytics from code | platform API (step 8) |
| A single agent driven by a dashboard prompt | platform, no code needed |

You can mix them. A crew agent still uses the platform API for numbers, campaigns, and logs.

## Deploy, call, and watch

After `agent-crew deploy` and Make Live:

```python
from smallestai import SmallestAI
c = SmallestAI(api_key="sk_...")
r = c.atoms.calls.start_outbound_call(
    agent_id="<agent-id>",
    phone_number="+1...",                 # number to ring
    from_product_id="<your-caller-id-product-id>",
)
print(r.data.conversation_id)             # CALL-...
```

Stream the live call in a terminal:

```bash
smallestai calls events <call-id>         # transcript, tool calls, latency, node transitions
```

Or in the browser with no phone number, open the agent on the dashboard and use the
Webcall tab. Read finished calls with `client.atoms.calls.get(id=call_id)` and
`client.atoms.calls.list(...)`, see [analytics](../analytics/) and
[call metrics docs](https://docs.smallest.ai/voice-agents/developer-guide/operate/analytics/call-metrics).

## Multi-agent, the two ways

- **In code (this guide, step 7).** Model sub-agents and their transitions in your crew
  node. Transitions are computed in plain Python off tool results, so they are
  deterministic and can skip a step based on data. This is the pattern to use when you
  need exact, data-driven control of the flow.
- **On the platform.** The platform multi-agent (an intent router over specialist
  playbooks) is rolling out, so a multi-agent can also be built and visualized on the
  dashboard. Ask us to enable it for your account.

## More building blocks in this cookbook

- Intent routing and department transfers, [inbound_ivr](../inbound_ivr/)
- A parallel background worker (sentiment, monitoring), [background_agent](../background_agent/)
- Deterministic computation and audit logging over a real DB, [bank_csr](../bank_csr/)
- Knowledge base retrieval, [knowledge_base_rag](../knowledge_base_rag/)
- Live tracing, [observability](../observability/)
