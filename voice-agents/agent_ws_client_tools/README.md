# Atoms Agent WebSocket — client tools

Minimal Node.js sample of the client-tools protocol on the Atoms Agent WebSocket. Declares a runtime client tool, handles the `function_call` event, and returns `function_call.result`.

The protocol lives on `wss://api.smallest.ai/atoms/v1/agent/connect`. A client tool is a function executed by **this client** (the browser, mobile app, or Node process) rather than by the server. The server routes tool invocations back over the same socket.

## Message flow

```
Client                                            Server
  │                                                 │
  │  POST /conversation/register-call ─────────────▶│  { access_token: wct_..., expires_in: 30 }
  │◀──────────────────────────────────────────────  │
  │                                                 │
  │  wss://.../agent/connect?token=wct_... ────────▶│
  │◀───── session.created ─────────────────────────  │
  │                                                 │
  │  ────── session.update (tools[]) ──────────────▶│
  │◀───── session.updated (tools accepted) ────────  │
  │                                                 │
  │           ... conversation happens ...          │
  │                                                 │
  │◀───── function_call (name, call_id, args) ─────  │
  │  ────── function_call.result (call_id, output) ▶│
  │                                                 │
```

## Client-tools rules

- **Runtime tools are additive to dashboard-configured tools.** A `session.update` replaces only the runtime set. Tools configured on the agent in the dashboard are always offered alongside.
- **`session.update` wholesale-replaces the runtime set.** It is not additive across calls.
- **Client tools are WebSocket-only.** They are never offered on telephony or WebRTC webcall channels.
- **`expectsResponse: true`** (default, "awaited"): the agent waits for `function_call.result` before continuing. Use when the result affects what the agent says next. Timeout via `timeout_ms` (1000–60000, default 15000).
- **`expectsResponse: false`** ("fire and forget"): the agent keeps talking immediately; no result expected; `timeout_ms` has no effect. Use for side effects the agent does not need the outcome of (logging, UI updates).
- **`output` is capped at 64 KB.** Truncate or summarise larger payloads before sending.
- **Error codes:** `tool_name_conflict`, `client_tools_managed_by_config`, `invalid_tools`, `tool_timeout`, `unknown_call_id`, `result_too_large`.

## Run it

```bash
cd voice-agents/agent_ws_client_tools
npm install
SMALLEST_API_KEY=sk_... AGENT_ID=<agent-id> npm start
```

The sample connects, declares a `lookup_order` client tool, and prints every event it receives. When the agent decides to call the tool (for example, after the caller says "look up order 1234"), the client returns a stub result and the agent responds. Extend `runTool` for your own tool set.

## Reference

- API reference: [Agent WebSocket](https://docs.smallest.ai/voice-agents/api-reference/realtime-agent/realtime-agent)
- Web SDK wrapper (browser): [`@smallest-ai/agent-sdk`](https://www.npmjs.com/package/@smallest-ai/agent-sdk)
- Browser three-step cookbook: [Browser Voice Cookbook](https://docs.smallest.ai/voice-agents/developer-guide/client-libraries/browser-voice-cookbook)
