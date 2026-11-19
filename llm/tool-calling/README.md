# Tool Calling (Electron)

Function calling with the Electron LLM through the OpenAI-compatible endpoint. Define tools with the standard OpenAI schema, let the model request a call, execute it locally, and feed the result back for the final answer.

## Try It

```bash
uv run tool_calling.py "What's the weather in Mumbai?"
```

Output:

```
Model called get_weather({'city': 'Mumbai'})

It's currently partly cloudy in Mumbai at about 29°C.
```

## Requirements

> Base dependencies are installed via the root `requirements.txt` (includes `openai`). See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env` (see `.env.sample`).

## How It Works

The endpoint is OpenAI-compatible, so the stock `openai` package works as-is:

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["SMALLEST_API_KEY"],
    base_url="https://api.smallest.ai/waves/v1",
)
```

The two-step tool loop:

1. `chat.completions.create(model="electron", messages=..., tools=...)`: the model either answers directly or returns `tool_calls`.
2. If it requested tools: execute each one locally (here, a stubbed `get_weather(city)`), append the assistant message and a `role: "tool"` message with the JSON result, then call `create` again. The model composes the final answer from the tool output.

Non-streaming for clarity. The same endpoint also speaks the plain `chat/completions` protocol, so everything else the `openai` client supports (streaming, system prompts, temperature) works the same way.

## API Reference

- [Waves API Reference](https://docs.smallest.ai/waves/api-reference)

## Next Steps

- [Agent with Tools](../../voice-agents/agent_with_tools/): tool calling inside a full voice agent
- [BYOM](../../voice-agents/byom/): point voice agents at any OpenAI-compatible LLM
