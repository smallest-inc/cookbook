# Web Call Session

Start a browser voice (or text chat) session for an Atoms agent from your server. Your backend calls the API with the secret key and hands the browser only what it needs to join the room. The API key never reaches the client.

## Try It

```bash
uv pip install -r requirements.txt

python start_session.py --agent-id <AGENT_ID>

# Or a text chat session
python start_session.py --agent-id <AGENT_ID> --chat
```

Output:

```
Starting web call session...
  token:           eyJhbGciOi...
  room_name:       0f6c1c1e-9b1a-4d5e-8f2a-...
  host:            wss://...livekit.cloud
  conversation_id: 68b1f0c2e4a1b2c3d4e5f6a7
  call_id:         68b1f0c2e4a1b2c3d4e5f6a8

After the call, fetch details with:
  client.atoms.calls.get(id="68b1f0c2e4a1b2c3d4e5f6a7")
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
| `conversation_id` | Correlates the session with transcripts and post-call analytics. |
| `call_id` | Call ID surfaced in call logs and analytics endpoints. |

The intended split:

- **Server** (this script): holds `SMALLEST_API_KEY`, creates the session, returns `token` + `host` to the frontend.
- **Browser**: passes `token` and `host` to the room client (e.g. the Atoms web SDK or a LiveKit client) to join the live session. It never sees the API key.
- **Afterwards**: `conversation_id` is what `client.atoms.calls.get(id=...)` tracks, so store it if you want transcripts, recordings, or analytics for the session.

## API Reference

- [Atoms API Reference](https://docs.smallest.ai/atoms/api-reference)

## Next Steps

- [Atoms SDK Web Agent](../atoms_sdk_web_agent/): full browser client that consumes a session like this
- [Analytics](../analytics/): pull post-call data for the conversations you start here
