# Notes for an AI coding agent adapting this sample

If you're a coding agent (Claude Code, Codex, Cursor, …) helping someone adapt
this crew call-transfer sample, these are the non-obvious things that break
transfers. Get them right — they are the exact issues real users hit.

## 1. A transfer only fires if the prompt tells the LLM to call the tool
`transfer_call` is a crew `@function_tool`. The model calls it only if the
**system prompt instructs it to** (see `cold_transfer.py` / `warm_transfer.py`).
With a custom LLM engine, that engine must emit the tool call. If the model
*narrates* "let me transfer you" but never transfers, force it with
`tool_choice="required"` on that turn:
`self.llm.chat(..., tools=self.tool_schemas, tool_choice="required")`
(`chat()` forwards extra kwargs to the model). Do **not** force it on every turn —
only where a transfer is expected, or it will call tools during normal chat.

## 2. The destination must actually answer
Set `TRANSFER_CALL_NUMBER` to a real number that will pick up. Do **not** transfer
to the same phone that placed/received the call (you can't answer a call you're
already on; DND rejects it). A transfer that "rejects in ~2s" is the destination
declining — not a bug in the SDK/platform.

## 3. Deploy is via the crew CLI, not `python app.py`
```
smallestai agent-crew init --agent-id <AGENT_ID>
smallestai agent-crew deploy --entry-point app.py   # then make the build live
```
The agent runs on the platform (connected over a websocket), not on localhost.

## 4. Inbound is config, not code
The same agent code receives inbound calls once you set `allow_inbound_call=True`
and assign a number (`enable_inbound.py` → `update_agent`). No dashboard toggle
needed for crew.

## 5. Custom LLM: use a stable endpoint
Point `CUSTOM_LLM_BASE_URL` at a reliable OpenAI-compatible endpoint. Anthropic's
raw OpenAI-compat URL is unreliable for streaming + tool-calls. ngrok→localhost is
fine for dev, but a transfer/turn fails with `ERR_NGROK_8012` when your local
process is down — bring it up or test off ngrok.

## 6. PII redaction rewrites the transcript (and defaults ON from the dashboard)
If the agent has redaction enabled, the surfaced transcript replaces names, emails, and
numbers with tags like `[USERNAME_1]` / `[ACCOUNTNUMBER_1]`, and it can eat a few leading
words around a detected email or URL (e.g. "my email address is jordan..." surfaces as
"is [AGE_1] [STREET_1] lee ... [URL_1]"). Speech-to-text captured the audio correctly;
redaction is what rewrites it. Creating an agent from the dashboard turns redaction **ON
by default** - if you don't want it, set `redactionConfig.isEnabled` to false in the agent
settings. It takes effect on the next call, no redeploy.

## 7. Do NOT enable `transfer_call` in the dashboard Tools panel
This sample is for a **crew** agent, where the tool lives in code (`@function_tool
transfer_call`). The dashboard Tools panel is for **single-prompt** agents. For a crew
agent the platform reads your code's tool and ignores the panel, so toggling
`transfer_call` there does nothing except cause confusion. Leave it off.

## 8. An agent is single-prompt OR crew, from creation
There is no in-place conversion. To get a crew agent, create an agent and attach the crew
(`agent-crew init --agent-id <id>` then `deploy`); don't try to turn a dashboard
single-prompt agent into a crew by toggling tools.

## Files
- `cold_transfer.py` / `warm_transfer.py` — the two transfer agents (differ only in `TransferOption`).
- `app.py` — deploy entry; picks cold/warm via `TRANSFER_MODE`, greets on pickup.
- `enable_inbound.py` — inbound enablement.
- `setup_agent_b.py` — creates a specialist agent for the agent-to-agent example.
