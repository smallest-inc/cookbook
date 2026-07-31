# TTS as LangChain Tool

Wrap Smallest AI's Lightning TTS as a LangChain `BaseTool` so any LangChain agent can generate speech.

## Why This Matters

LangChain agents produce text. In voice AI applications, that text needs to become audio. By wrapping Lightning TTS as a tool, your agent can generate speech mid-chain and decide **when** to speak vs. return text.

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../../README.md#usage) for setup. Install LangChain deps from `integrations/langchain/`. Copy `../.env.sample` to `.env` and add your API keys.

## Usage

### As a standalone tool

```python
from tts_tool import LightningTTSTool

tts = LightningTTSTool(api_key="your_smallest_api_key")
audio_path = tts.run("Your order has been confirmed. Is there anything else I can help with?")
print(audio_path)
# "output/tts_output.wav"
```

### Inside a LangChain agent

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver
from tts_tool import LightningTTSTool

tools = [LightningTTSTool(api_key="your_smallest_api_key")]
checkpointer = InMemorySaver()

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=tools,
    system_prompt="You are a voice assistant. Use the text_to_speech tool to speak your responses.",
    checkpointer=checkpointer,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "Say hello and introduce yourself"}]},
    config={"configurable": {"thread_id": "demo"}},
)
```

### In an LCEL chain

```python
from langchain_core.runnables import RunnableLambda
from tts_tool import LightningTTSTool

tts = LightningTTSTool(api_key="your_key")

chain = prompt | llm | RunnableLambda(lambda resp: tts.run(resp.content))
audio_path = chain.invoke({"input": "What's the weather like?"})
```

## Structure

```
tts-as-langchain-tool/
└── tts_tool.py    # LightningTTSTool — LangChain BaseTool wrapping Lightning TTS
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `voice_id` | `"magnus"` | Voice to use for synthesis |
| `sample_rate` | `24000` | Audio sample rate in Hz |
| `output_dir` | `"output"` | Directory to save generated audio files |

## API Reference

- [Lightning TTS Overview](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech-new/overview)
- [TTS API Reference](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-tts)

## Next Steps

- [STT as LangChain Tool](../stt-as-langchain-tool/) — Transcribe audio with Pulse
- [Voice-Optimized Prompts](../voice-optimized-prompts/) — Write prompts that sound good when spoken
- [Voice AI Agent](../examples/voice-ai-agent/) — Full end-to-end example
