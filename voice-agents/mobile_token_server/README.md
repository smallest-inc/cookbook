# Mobile session server

A small Node server that keeps your Smallest API key off the phone. The React Native examples ([react_native_voice_agent](../react_native_voice_agent/) and [react_native_voice_widget](../react_native_voice_widget/)) call it to get a short-lived token, then connect to the Agent WebSocket with that token.

## Why

Anything in a mobile app bundle can be extracted, including every `EXPO_PUBLIC_*` variable, which Metro inlines into the JavaScript. If the app holds your org API key, anyone with the app holds it too, and can use it for any API call on your account. This server holds the key instead and gives the app only:

- a token for **one** agent (the `AGENT_ID` configured on the server),
- that expires after **30 seconds** and works for **one** connection.

## Endpoints

| Method and path | What it does |
|---|---|
| `POST /session` | Calls `POST /atoms/v1/conversation/register-call` for `AGENT_ID` and returns `{ token, expiresIn }`. The app picks the audio rate itself and connects to `wss://api.smallest.ai/atoms/v1/agent/connect?token=<token>&mode=webcall&sample_rate=<rate>`. Rate limited per client address (`SESSIONS_PER_MINUTE`, default 10). |
| `GET /agent` | Returns the agent's name, voice, speed and language, plus `editable`. No prompt, no secrets. |
| `POST /agent/config` | Body `{ voiceId?, voiceModel?, speed?, language? }`. Validates the values, writes them to the live branch's draft and publishes it. Returns `{ revision }`. **Disabled unless `ALLOW_AGENT_EDITS=true`.** |
| `GET /healthz` | `{ ok: true }` |

## Run

Node 18 or later, no dependencies.

```bash
# From an app folder, reusing its .env (Node 20.6+ for --env-file)
cd ../react_native_voice_agent
node --env-file=.env ../mobile_token_server/server.mjs

# Or with plain environment variables
SMALLEST_API_KEY=sk_... AGENT_ID=... node server.mjs
```

| Variable | Default | Meaning |
|---|---|---|
| `SMALLEST_API_KEY` | required | Your API key. Only this server sees it. |
| `AGENT_ID` | required | The one agent this server mints tokens for. The app cannot pick another agent. |
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` only to reach the server from a phone on your Wi-Fi. |
| `PORT` | `8787` | Port. |
| `ALLOW_AGENT_EDITS` | `false` | Enables `POST /agent/config`. Leave it off unless you are developing locally. |
| `SESSIONS_PER_MINUTE` | `10` | Token requests allowed per client address per minute. |

## Reaching it from a phone

- iOS simulator: `http://localhost:8787`. Android emulator: `http://10.0.2.2:8787`.
- Physical device on the same Wi-Fi: start with `HOST=0.0.0.0` and use `http://<your-computer-LAN-IP>:8787`. iOS App Transport Security or Android cleartext rules can block plain `http://` to a LAN address in some build configurations. If that happens, put the server behind an HTTPS tunnel and use the `https://` URL instead.

## Security notes

- The key is read from the environment and only used in the `Authorization` header of calls to `api.smallest.ai`. It is never logged or returned. Upstream error bodies are not passed back to the app.
- Requests that carry an `Origin` header (that is, requests from a web page) are rejected, and POSTs must be `application/json`. That stops websites you visit, including DNS rebinding tricks, from using a server running on your machine.
- Agent edits are off by default and only accept a fixed set of fields with validated values.
- **This is a development server.** It has no user authentication: anyone who can reach it can start sessions with your agent, which costs you minutes. For production, run it behind HTTPS, put your own user login in front of `/session` (for example, check your app's session cookie or JWT), and keep `ALLOW_AGENT_EDITS` off or behind an admin check.
