# Bring Your Own Model (BYOM)

Swap the default LLM for any OpenAI-compatible endpoint. Point `OpenAIClient` at hosted Claude, a self-hosted vLLM/Ollama box, or anything that speaks `POST /v1/chat/completions`. The crew node code doesn't change.

## Features

- **`OpenAIClient(base_url=...)`.** Redirect chat completions to any OpenAI-compatible endpoint.
- **Conversation history handled by the SDK.** `self.context.messages` accumulates turns; no manual state.
- **Local run and deploy.** Same node code works with `python server.py` and `agent-crew deploy`.

## Demo

**Hosted Claude via a proxy.**

```python
self.llm = OpenAIClient(
    model="claude-3-5-sonnet-20241022",
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    base_url="https://api.anthropic.com/v1",   # or your OpenAI-shim proxy
)
```

**Local Ollama for offline dev.**

```python
self.llm = OpenAIClient(
    model="llama3.2",
    api_key="ollama",   # any string, Ollama ignores it
    base_url="http://localhost:11434/v1",
)
```

**Local Ollama exposed to a deployed crew via ngrok.**

```python
self.llm = OpenAIClient(
    model="llama3.2",
    api_key="ollama",
    base_url="https://<subdomain>.ngrok-free.app/v1",
)
```

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

Env vars in `.env`:

```
SMALLEST_API_KEY=sk_...
# One of these, depending on the model you point at:
ANTHROPIC_API_KEY=sk-ant-...
# or (Ollama takes any string):
OLLAMA_API_KEY=ollama
```

## Usage

### Run locally (localhost `base_url` is fine)

```bash
uv pip install -r requirements.txt
uv run server.py
```

Connect with the CLI:

```bash
smallestai agent-crew chat
```

### Deploy (localhost `base_url` is not fine)

A deployed crew runs in the cloud. It cannot reach `http://localhost:11434` on your laptop. You have two options.

**Option A: hosted model.** Use a reachable public endpoint (Anthropic, OpenAI, Together, your own hosted vLLM). Change `base_url` and deploy.

**Option B: tunnel your local model.** Expose your Ollama (or vLLM) with ngrok. For **Ollama specifically**, you must pass `--host-header` or Ollama returns 403.

```bash
ngrok http 11434 --host-header=localhost:11434
```

Then set `base_url` to the ngrok URL plus `/v1`:

```python
base_url="https://<your-subdomain>.ngrok-free.app/v1"
```

Deploy the crew:

```bash
smallestai agent-crew deploy
smallestai agent-crew builds        # Make Live
```

## Key Snippets

### Assistant node with a configurable LLM

```python
import os
from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.nodes import OutputCrewNode


class Assistant(OutputCrewNode):
    def __init__(self):
        super().__init__(name="assistant")
        self.llm = OpenAIClient(
            model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
            api_key=os.getenv("LLM_API_KEY"),
            base_url=os.getenv("LLM_BASE_URL"),   # None = default (OpenAI)
        )
        self.context.messages.append(
            {"role": "system", "content": "You are a friendly, concise voice assistant."}
        )

    async def generate_response(self):
        response = await self.llm.chat(messages=self.context.messages, stream=True)
        full = ""
        async for chunk in response:
            if chunk.content:
                full += chunk.content
                yield chunk.content
        # add_message takes a single dict, not two positional args.
        self.context.add_message({"role": "assistant", "content": full})
```

## Recommended Usage

- Any team with an existing LLM contract (Anthropic, Together, self-hosted, on-prem).
- Local development against Ollama or vLLM before a deploy.
- Cost or latency profiling by swapping models without touching the crew logic.

## Gotchas

- **`localhost` only works for local runs.** Deployed crews run in the cloud and cannot reach your laptop. For deploy, use a hosted endpoint or a tunnel.
- **Ollama over ngrok needs `--host-header=localhost:11434`.** Without it Ollama returns 403 on requests through the tunnel. This is an Ollama-side check, not an ngrok bug.
- **`add_message` takes one dict, not two positional args.** Correct: `self.context.add_message({"role": "assistant", "content": text})`. Any older example calling `add_message("assistant", text)` will crash on 5.3+.
- **Streaming is required for low-latency voice.** Pass `stream=True` on the chat call; don't buffer the full response before yielding.
- **First call after Make Live can be silent while the pod warms up.** Retry once. Subsequent calls answer normally. See [Telephony](../telephony/#gotchas).
