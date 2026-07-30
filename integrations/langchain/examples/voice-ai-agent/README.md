# Voice AI Agent — End-to-End Example

A **full working example** of a voice AI agent using LangChain for dialog management with Smallest AI for STT and TTS.

## Why This Matters

This example shows the complete voice AI loop: audio comes in, gets transcribed, feeds into a LangChain agent with tools and memory, and the response goes through TTS back to audio. Use it as a starting point for building voice agents.

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../../../README.md#usage) for setup. Install LangChain deps from `integrations/langchain/`. Copy `../../.env.sample` to `.env` and add your API keys.

## Usage

### Run with an audio file

```bash
python agent.py --audio path/to/recording.wav
```

### Run in interactive mode (text)

```bash
python agent.py --interactive
```

### Generate audio responses

Add `--speak` to hear the agent's response as audio:

```bash
python agent.py --interactive --speak
python agent.py --audio recording.wav --speak
```

## Structure

```
voice-ai-agent/
├── agent.py         # Main: full voice AI loop (STT → agent → TTS)
├── tools.py         # LangChain mock tools: weather, order status, appointments
└── voice_chain.py   # Agent setup: prompt + memory + tools + LLM
```

## Example Session

```
$ python agent.py --interactive

Voice AI Agent (interactive mode)
Type your messages. The agent will respond as if on a phone call.
Type 'quit' to exit.
================================================

You: Hi, what's the weather like in San Francisco?

Agent: It's about sixty two degrees and foggy in San Francisco right now.
       Anything else I can help with?

You: Can you check on my order? Number 45678.

Agent: Let me look that up. Order forty five six seven eight shipped
       yesterday and should arrive by Thursday. Want the tracking number?
```

## Configuration

| Parameter | Description |
|-----------|-------------|
| `--audio` | Path to audio file to transcribe and process |
| `--interactive` | Run in text mode (type as the caller) |
| `--speak` | Generate audio response using TTS |
| `model` in `voice_chain.py` | LLM model (default: gpt-4o-mini) |
| `voice_id` in `agent.py` | TTS voice (default: magnus) |

## API Reference

- [Pulse STT Overview](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview)
- [Lightning TTS Overview](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech-new/overview)
- [LangChain Agents](https://python.langchain.com/docs/concepts/agents/)

## Next Steps

- [Voice-Optimized Prompts](../../voice-optimized-prompts/) — Deep dive on prompt strategies
- [Conversation Memory](../../conversation-memory-for-voice/) — Advanced memory patterns
