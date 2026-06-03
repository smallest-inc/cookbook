# Pipecat + Smallest AI

Build voice agent pipelines using Pipecat with Smallest AI as the TTS/STT provider.

## Installation

```bash
pip install "pipecat-ai[smallest]"
```

For the full voice agent example with Daily transport, OpenAI LLM, and Silero VAD:

```bash
pip install "pipecat-ai[smallest,daily,openai,silero,runner]"
```

## Usage

### TTS + STT

```python
import os
from pipecat.services.smallest.stt import SmallestSTTService
from pipecat.services.smallest.tts import SmallestTTSService, SmallestTTSModel
from pipecat.transcriptions.language import Language

stt = SmallestSTTService(
    api_key=os.getenv("SMALLEST_API_KEY"),
    settings=SmallestSTTService.Settings(
        language=Language.EN,
    ),
)

# Default model is lightning_v3.1_pro (voice: meher)
# Use lightning_v3.1 for the lighter model (voice: sophia)
tts = SmallestTTSService(
    api_key=os.getenv("SMALLEST_API_KEY"),
    output_format="pcm",
    settings=SmallestTTSService.Settings(
        model=SmallestTTSModel.LIGHTNING_V3_1_PRO,
        voice="meher",
        language=Language.EN,
    ),
)

# Build pipeline: mic → STT → LLM → TTS → speaker
from pipecat.pipeline.pipeline import Pipeline
pipeline = Pipeline([transport.input(), stt, llm, tts, transport.output()])
```

### TTS Parameters Reference

**Constructor parameters:**

| Parameter         | Default | Description                                                                                                                                                                                              |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output_format`   | `pcm`   | Audio format: `pcm`, `mp3`, `wav`, `ulaw`, `alaw`                                                                                                                                                       |
| `word_timestamps` | `True`  | Emit per-word `TTSTextFrame`s aligned to audio playback. Enabled by default. Supported on base-queue English + Hindi voices (`meher`, `devansh`, `kartik`, `maithili`, `liam`, `avery`); other voices silently emit no word events, so leaving this on is safe. Pass `word_timestamps=False` to fall back to whole-text frames. |

**Settings (`SmallestTTSService.Settings`):**

| Setting    | Default              | Description                                            |
| ---------- | -------------------- | ------------------------------------------------------ |
| `model`    | `lightning_v3.1_pro` | Model to use: `lightning_v3.1` or `lightning_v3.1_pro` |
| `voice`    | model-dependent      | Voice ID. Default: `meher` (pro), `sophia` (v3.1)      |
| `language` | `en`                 | Language code for synthesis                            |
| `speed`    | `None`               | Speech speed multiplier (0.5–2.0)                      |

Model changes take effect on the next utterance — no reconnection needed.

## Full Example

A complete runnable voice agent is available in the Pipecat repository:

[`examples/voice/voice-smallest.py`](https://github.com/pipecat-ai/pipecat/blob/main/examples/voice/voice-smallest.py)

## Resources

- [Pipecat + Smallest AI Docs](https://docs.smallest.ai/waves/v-4-0-0/integrations/pipecat)
- [Pipecat Docs](https://docs.pipecat.ai/)
- [Pipecat GitHub](https://github.com/pipecat-ai/pipecat)
- [Smallest AI Docs](https://docs.smallest.ai)
