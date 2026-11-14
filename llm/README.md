# LLM

Text generation with [Electron](https://docs.smallest.ai/waves/api-reference), Smallest AI's LLM, via an OpenAI-compatible `chat/completions` endpoint.

## Endpoint

```
https://api.smallest.ai/waves/v1/chat/completions
```

Use the stock `openai` package: `OpenAI(api_key=..., base_url="https://api.smallest.ai/waves/v1")` with `model="electron"`. Standard chat completions, streaming, and function calling all work unchanged.

## Examples

- [Tool Calling](./tool-calling/): function calling with the standard OpenAI tools schema. The model requests a tool, you execute locally, the model composes the answer.
