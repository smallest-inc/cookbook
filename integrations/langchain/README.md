# LangChain

> **Powered by [LangChain](https://python.langchain.com/) + [Smallest AI](https://smallest.ai)**

Use LangChain for chains, agents, memory, and prompt orchestration. Use Smallest AI for speech-to-text (Pulse STT) and text-to-speech (Lightning TTS). Use them together they make a complete voice AI system.

## Integrations

| Integration | Description |
|-------------|-------------|
| [STT as LangChain Tool](./stt-as-langchain-tool/) | Wrap Pulse STT as a LangChain Tool — agents can transcribe audio on demand |
| [TTS as LangChain Tool](./tts-as-langchain-tool/) | Wrap Lightning TTS as a LangChain Tool — agents can generate speech |
| [Voice-Optimized Prompts](./voice-optimized-prompts/) | Prompt templates tuned for spoken output |
| [Conversation Memory for Voice](./conversation-memory-for-voice/) | Memory strategies for voice conversations |

## Examples

| Example | Description |
|---------|-------------|
| [Voice AI Agent](./examples/voice-ai-agent/) | End-to-end voice agent: audio in → STT → LangChain agent with tools + memory → TTS → audio out |

## Quick Start

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup.

Install LangChain dependencies:

```bash
uv pip install -r requirements.txt
```

Set up your API keys:

```bash
export SMALLEST_API_KEY="your-smallest-api-key"
export OPENAI_API_KEY="your-openai-api-key"
```

Or copy [.env.sample](./.env.sample) and fill in your keys.

## Snippets

Reusable code snippets live in [snippets](./snippets/).

## Documentation

- [LangChain Docs](https://python.langchain.com/docs/)
- [Pulse STT (Smallest AI)](https://waves-docs.smallest.ai/models/speech-to-text/overview)
- [Lightning TTS (Smallest AI)](https://waves-docs.smallest.ai/models/text-to-speech/overview)
