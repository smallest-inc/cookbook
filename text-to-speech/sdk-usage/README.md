# SDK Usage

Text-to-speech through the `smallestai` Python SDK. One client covers sync, async, and streaming.

```bash
pip install smallestai
export SMALLEST_API_KEY="your-key"
```

## Sync synthesis

```python
from smallestai import SmallestAI

client = SmallestAI()  # reads SMALLEST_API_KEY from the environment

audio = b"".join(client.waves.synthesize_tts(
    text="Hello from the Python SDK!",
    voice_id="sophia",
    model="lightning_v3.1",
    sample_rate=24000,
    output_format="wav",
))
with open("hello.wav", "wb") as f:
    f.write(audio)
```

## Async synthesis

```python
import asyncio
from smallestai import AsyncSmallestAI

async def main():
    client = AsyncSmallestAI()
    chunks = []
    async for chunk in client.waves.synthesize_tts(
        text="Async works the same way.",
        voice_id="sophia",
        model="lightning_v3.1",
    ):
        chunks.append(chunk)
    with open("hello_async.wav", "wb") as f:
        f.write(b"".join(chunks))

asyncio.run(main())
```

## Streaming over WebSocket

```python
from smallestai.waves import WavesStreamingTTS, TTSConfig

config = TTSConfig(voice_id="sophia", model="lightning_v3.1", api_key="YOUR_API_KEY")
streaming_tts = WavesStreamingTTS(config)
for chunk in streaming_tts.synthesize("Streaming audio, chunk by chunk."):
    ...  # play or buffer each PCM chunk as it arrives
```

For SSE streaming use `client.waves.synthesize_sse_tts(...)` with the same payload.

## Utility methods

```python
voices = client.waves.get_voices(model="lightning-v3.1")
clones = client.waves.list_voice_clones()
```

## API Reference

- [Python SDK on GitHub](https://github.com/smallest-inc/smallest-python-sdk)
- [TTS documentation](https://docs.smallest.ai/waves/documentation/text-to-speech-lightning/quickstart)
