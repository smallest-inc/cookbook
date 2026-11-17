// Minimal end-to-end sample of the Atoms Agent WebSocket client-tools
// protocol shipped in PR #337 / #378.
//
// Flow:
//   1. POST /atoms/v1/conversation/register-call with your API key + agent_id.
//      Server returns a short-lived (30 s) `wct_` access token.
//   2. Open wss://api.smallest.ai/atoms/v1/agent/connect?token=<wct_>.
//      Server sends `session.created`.
//   3. Send `session.update` declaring runtime client tools.
//      Server ACKs with `session.updated`, or rejects with `error`
//      (`tool_name_conflict` / `client_tools_managed_by_config` / `invalid_tools`).
//   4. When the agent decides to call a tool, server sends `function_call`
//      with `{ call_id, name, arguments }`. Reply with `function_call.result`
//      carrying the same `call_id` and a stringified `output` (<= 64 KB).
//
// Requires: node >=18, npm install ws.
// Set SMALLEST_API_KEY and AGENT_ID before running.

import WebSocket from "ws";

const API_KEY = process.env.SMALLEST_API_KEY;
const AGENT_ID = process.env.AGENT_ID;
const BASE = process.env.SMALLEST_BASE_URL ?? "https://api.smallest.ai";

if (!API_KEY || !AGENT_ID) {
  console.error("SMALLEST_API_KEY and AGENT_ID must be set.");
  process.exit(1);
}

// 1. Mint a short-lived access token.
async function mintToken() {
  const res = await fetch(`${BASE}/atoms/v1/conversation/register-call`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ agent_id: AGENT_ID }),
  });
  if (!res.ok) throw new Error(`register-call ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.data.access_token;
}

// Runtime client tools declared on this connection.
const TOOLS = [
  {
    type: "function",
    name: "lookup_order",
    description: "Look up an order in our system by id.",
    parameters: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
    },
    timeout_ms: 15000,
    expectsResponse: true,
  },
];

// Your implementation of the declared tools. Return a stringified output
// (typically JSON). The result is capped at 64 KB by the server.
async function runTool(name, args) {
  if (name === "lookup_order") {
    // Replace with a real lookup. This is a stub so the sample stands alone.
    return JSON.stringify({
      order_id: args.order_id,
      status: "out_for_delivery",
      eta: "tomorrow",
    });
  }
  throw new Error(`no handler for tool '${name}'`);
}

async function main() {
  const token = await mintToken();
  const wsUrl = `${BASE.replace(/^http/, "ws")}/atoms/v1/agent/connect?token=${token}`;
  console.log(`opening ${wsUrl.slice(0, 60)}...`);

  const ws = new WebSocket(wsUrl);
  const send = (obj) => ws.send(JSON.stringify(obj));

  ws.on("open", () => console.log("ws open"));

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case "session.created":
        console.log(`session.created  call_id=${msg.call_id}  sr=${msg.sample_rate}`);
        // Declare runtime client tools.
        send({ type: "session.update", tools: TOOLS });
        break;

      case "session.updated":
        console.log(`session.updated  accepted=${JSON.stringify(msg.tools)}`);
        break;

      case "function_call":
        console.log(`function_call  name=${msg.name}  call_id=${msg.call_id}  args=${JSON.stringify(msg.arguments)}`);
        try {
          const output = await runTool(msg.name, msg.arguments);
          send({ type: "function_call.result", call_id: msg.call_id, output });
        } catch (err) {
          // If your tool fails, return the error as the output so the
          // agent can respond gracefully. The server treats any string
          // as a valid result; the agent decides what to say.
          send({
            type: "function_call.result",
            call_id: msg.call_id,
            output: JSON.stringify({ error: String(err) }),
          });
        }
        break;

      case "error":
        console.error(`error  code=${msg.code}  message=${msg.message}`);
        // Client-tools error codes documented in the AsyncAPI spec:
        //   tool_name_conflict, client_tools_managed_by_config, invalid_tools,
        //   tool_timeout, unknown_call_id, result_too_large.
        break;

      case "session_ended":
      case "session.closed":
        console.log(`session ended  reason=${msg.reason}`);
        ws.close();
        break;

      // Audio frames and other events are elided in this sample.
      // Extend as needed for your client.
    }
  });

  ws.on("close", (code) => console.log(`ws closed  code=${code}`));
  ws.on("error", (err) => console.error(`ws error: ${err.message}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
