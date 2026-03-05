# LiveKit + Smallest AI

Build real-time voice agents using LiveKit's Agents framework with Smallest AI TTS.

## Status

| Feature | Status | Package |
|---------|--------|---------|
| TTS (Text-to-Speech) | Merged (Aug 2025) | `livekit-plugins-smallestai` |
| STT (Speech-to-Text) | PR Open ([#4858](https://github.com/livekit/agents/pull/4858)) | — |

> **Note:** The current `livekit-plugins-smallestai` (v1.4.4) supports `lightning`, `lightning-large`, and `lightning-v2` models. Lightning v3.1 and v3.2 (expressive) are not yet supported. A plugin update is planned.

## Install

```bash
pip install "livekit-agents[smallestai]"
```

## Basic Usage

```python
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai, smallestai

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession(
        tts=smallestai.TTS(voice_id="emily"),  # Smallest AI TTS
        llm=openai.LLM(model="gpt-4o-mini"),
    )

    await session.start(ctx.room)
    await session.say("Hello! I'm powered by Smallest AI voice synthesis.")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

## Configuration

```python
smallestai.TTS(
    model="lightning-large",   # lightning, lightning-large, lightning-v2
    voice_id="emily",
    sample_rate=24000,
    speed=1.0,
    language="en",
)
```

## Resources

- [LiveKit Agents Docs](https://docs.livekit.io/agents/)
- [livekit-plugins-smallestai on PyPI](https://pypi.org/project/livekit-plugins-smallestai/)
- [Smallest AI Docs](https://waves-docs.smallest.ai)
