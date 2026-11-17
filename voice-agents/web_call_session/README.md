# Web Call Session

Start a browser voice (or text chat) session for an Atoms agent from your server. Your backend calls the API with the secret key and hands the browser only what it needs to join the room. The API key never reaches the client.

## Try It

```bash
uv pip install -r requirements.txt

python start_session.py --agent-id <AGENT_ID>

# Or a text chat session
python start_session.py --agent-id <AGENT_ID> --chat
```

Output (the token is masked unless you pass `--show-token`):

```
Starting web call session...
  token:           eyJhbGciOi... (pass --show-token to print it)
  room_name:       0f6c1c1e-9b1a-4d5e-8f2a-...
  host:            wss://...livekit.cloud
  conversation_id: 68b1f0c2e4a1b2c3d4e5f6a7
  call_id:         CALL-1763400000000-a1b2c3

After the call, fetch details with:
  client.atoms.calls.get(id="CALL-1763400000000-a1b2c3")
```

## Requirements

> Base dependencies are installed via the root `requirements.txt`, plus `smallestai>=5.12.0` from the local `requirements.txt`. Add `SMALLEST_API_KEY` (and optionally `AGENT_ID`) to your `.env` (see `.env.sample`).

## How It Works

One SDK call creates a session:

```python
from smallestai import SmallestAI

client = SmallestAI()
response = client.atoms.web_call.start_web_call_conversation(agent_id="...")
session = response.data
```

`start_web_chat_conversation(agent_id=...)` is the same shape for text chat sessions.

`response.data` contains:

| Field | What it is |
|-------|------------|
| `token` | Short-lived room access token. Safe to send to the browser. |
| `room_name` | Room UUID pre-created for this session. |
| `host` | WebSocket URL the room client connects to. |
| `conversation_id` | Internal ID of the conversation record. |
| `call_id` | Call ID used by call logs and analytics. Pass this one to `client.atoms.calls.get`. |

The intended split:

- **Server** (this script): holds `SMALLEST_API_KEY`, creates the session, returns `token` + `host` to the frontend.
- **Browser**: passes `token` and `host` to the room client (for example the Atoms web SDK or a LiveKit client) to join the live session. It never sees the API key.
- **Afterwards**: store `call_id` if you want transcripts, recordings, or analytics for the session, and fetch them with `client.atoms.calls.get(id=call_id)`. Passing `conversation_id` there returns 404 "logs not found".

## API Reference

- [Atoms API Reference](https://docs.smallest.ai/atoms/api-reference)

## Next Steps

- [Atoms SDK Web Agent](../atoms_sdk_web_agent/): full browser client that consumes a session like this
- [Analytics](../analytics/): pull post-call data for the conversations you start here
