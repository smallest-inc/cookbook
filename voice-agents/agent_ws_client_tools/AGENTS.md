# Agents playbook — `agent_ws_client_tools`

Minimal end-to-end demo of the client-tools protocol on the Atoms Agent WebSocket. If you are Claude / Cursor / Codex following this file, the steps below cover the full flow.

## What this sample does

1. Mints a short-lived `wct_` access token via `POST /atoms/v1/conversation/register-call` using a server-side API key.
2. Opens the Agent WebSocket at `wss://api.smallest.ai/atoms/v1/agent/connect?token=<wct_>`.
3. Declares a runtime client tool (`lookup_order`) via `session.update`.
4. Waits for `function_call`, executes the tool locally, replies with `function_call.result`.

## Extending it

- **Add a tool:** append to the `TOOLS` array in `index.mjs` (JSON Schema in `parameters`), then add a branch in `runTool` for the new `name`.
- **Fire-and-forget side effects (logging, UI):** set `expectsResponse: false` on the tool declaration. The agent will not wait for a result and `timeout_ms` will have no effect.
- **Tighten the timeout:** set `timeout_ms` per tool (clamped 1000–60000, default 15000). If the tool exceeds the timeout, the server sends `tool_timeout` back to the agent.
- **Handle audio:** this sample skips `output_audio.delta` frames. For a full browser client, decode the base64 PCM16 chunks and play them through an `AudioWorklet` at the negotiated `sample_rate` from `session.created`.

## Gotchas

- Access tokens are 30-second, single-use. Mint a fresh one per WebSocket.
- `session.update` replaces the previously declared runtime tools. It is not additive across calls.
- Tool names on `session.update` must not collide with an **enabled** dashboard tool. Collisions with disabled dashboard tools are fine.
- Client tools are only offered on this WebSocket channel. Telephony and WebRTC webcall channels do not offer them.
- Server sends the accepted tool names back in `session.updated.tools`. Log them.

## Files

- `index.mjs` — the runnable client
- `package.json` — deps (just `ws`)
- `README.md` — human-readable overview

Requires Node 18 or later.
