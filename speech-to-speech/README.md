# Speech-to-Speech

Full-duplex voice conversations with [Hydra](https://docs.smallest.ai/waves/documentation/speech-to-speech-hydra/overview): stream microphone audio in, receive streamed spoken responses back over one WebSocket. No separate STT/LLM/TTS pipeline to wire up.

## Endpoint

```
wss://api.smallest.ai/waves/v1/s2s?model=hydra&api_key=<SMALLEST_API_KEY>
```

Every frame is JSON, discriminated by `type` (`session.*`, `input_audio_buffer.*`, `response.*`, `conversation.item.*`, `error`). Audio travels as base64 PCM16 at 16 kHz. See the [Hydra realtime guide](https://docs.smallest.ai/waves/documentation/speech-to-speech-hydra/overview) for the full event reference.

With the Python SDK:

```python
from smallestai import SmallestAI

client = SmallestAI()
with client.waves.speech_to_speech.connect() as socket:
    ...
```

## Examples

- [Hydra Realtime Demo](./hydra-realtime-demo/) — Next.js browser client with multi-agent presets (companion, restaurant, banking), client-side tool calling, a wire-log of every WebSocket frame, and persona/voice editing. Mirror of [smallest-inc/hydra_agents](https://github.com/smallest-inc/hydra_agents).
