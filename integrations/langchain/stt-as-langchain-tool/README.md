# STT as LangChain Tool

Wrap Smallest AI's Pulse STT as a LangChain `BaseTool` so any LangChain agent can transcribe audio files on demand.

## Why This Matters

LangChain agents can call tools to gather information. By wrapping Pulse STT as a tool, your agent can transcribe audio files (call recordings, voice notes) as part of a multi-step chain — and decide **when** to transcribe based on conversation context.

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../../README.md#usage) for setup. Install LangChain deps from `integrations/langchain/`. Copy `../.env.sample` to `.env` and add your API keys.

## Usage

### As a standalone tool

```python
from stt_tool import PulseSTTTool

stt = PulseSTTTool(api_key="your_smallest_api_key")
transcript = stt.run("path/to/recording.wav")
print(transcript)
# "Hello, I'd like to place an order for the pro plan."
```

### Inside a LangChain agent

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver
from stt_tool import PulseSTTTool

tools = [PulseSTTTool(api_key="your_smallest_api_key")]
checkpointer = InMemorySaver()

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=tools,
    system_prompt="You help users by transcribing audio and answering questions about the content.",
    checkpointer=checkpointer,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "Transcribe the file at recordings/call_001.wav and summarize it"}]},
    config={"configurable": {"thread_id": "demo"}},
)
```

### In an LCEL chain

```python
from langchain_core.runnables import RunnableLambda
from stt_tool import PulseSTTTool

stt = PulseSTTTool(api_key="your_key")

transcribe = RunnableLambda(lambda x: stt.run(x["audio_path"]))
summarize = prompt | llm  # your summarization chain

chain = transcribe | (lambda transcript: {"text": transcript}) | summarize
result = chain.invoke({"audio_path": "recording.wav"})
```

## Structure

```
stt-as-langchain-tool/
└── stt_tool.py    # PulseSTTTool — LangChain BaseTool wrapping Pulse STT
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `language` | `"en"` | ISO 639-1 code or `"multi"` for auto-detect |
| `word_timestamps` | `False` | Include word-level timestamps in output |
| `diarize` | `False` | Enable speaker diarization |
| `emotion_detection` | `False` | Detect speaker emotions |

## API Reference

- [Pulse STT Overview](https://waves-docs.smallest.ai/models/speech-to-text/overview)
- [Pre-recorded API](https://waves-docs.smallest.ai/models/speech-to-text/pre-recorded/quickstart)

## Next Steps

- [TTS as LangChain Tool](../tts-as-langchain-tool/) — Generate speech from agent responses
- [Voice-Optimized Prompts](../voice-optimized-prompts/) — Write prompts that sound good when spoken
- [Voice AI Agent](../examples/voice-ai-agent/) — Full end-to-end example
