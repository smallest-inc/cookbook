# Deterministic multi-agent

Three sub-agents in one crew node, with data-dependent transitions and a step that is
skipped based on data. The flow is:

```
intake  --(already verified)-->  resolve
   |                                ^
   +----(not verified)--> verify ---+
```

The transitions are computed in plain Python off tool results, so they are deterministic.
`start_intake` looks the caller up and, if they were already verified before, sends the
flow straight to `resolve`, skipping `verify`. That "skip a step based on data" is a
normal `if` in `assistant.py`, not an LLM decision.

## How it works

- Each sub-agent is a focused system prompt plus a scoped set of tools, keyed by
  `self.state` (`intake`, `verify`, `resolve`).
- Every turn, `generate_response` rebuilds the LLM context for the current sub-agent and
  exposes only that sub-agent's tools.
- A tool can move the flow with `self._go(next_state)`, which also emits an
  `SDKAgentLogEvent`, so the sub-agent path shows up on the call's Events tab.
- Shared data collected along the way lives in `self.data`.

## Run

```bash
pip install -r ../requirements.txt        # or: pip install smallestai openai python-dotenv loguru
cp ../.env.sample .env                     # set OPENAI_API_KEY (or your OpenAI-compatible endpoint)
python server.py                           # terminal 1
smallestai agent-crew chat                 # terminal 2
```

Try customer id `1001` (already verified, skips verify) and `1002` (goes through verify).
Watch the `subagent_transition` log events to see the deterministic path.

## Deploy

```bash
smallestai agent-crew init --agent-id <agent-id>
smallestai agent-crew deploy --entry-point server.py
smallestai agent-crew builds               # Make Live
```

## Notes

- This pattern gives you exact, data-driven control of the flow today. You own the state
  machine, which is what makes it deterministic.
- The platform multi-agent (an intent router over specialist playbooks) is rolling out for
  building and visualizing multi-agent on the dashboard. Ask us to enable it for your
  account if you want the UI path as well.
