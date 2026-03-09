# Pipecat + Smallest AI

Build voice agent pipelines using Pipecat with Smallest AI as the TTS/STT provider.

## Status

| Feature | Status | PR |
|---------|--------|-----|
| TTS + STT | PR Open | [#3860](https://github.com/pipecat-ai/pipecat/pull/3860), [#3897](https://github.com/pipecat-ai/pipecat/pull/3897) |

> **Note:** Pipecat integration is not yet merged. This recipe will be updated once the PR is accepted. In the meantime, you can install from the PR branch:

```bash
pip install git+https://github.com/pratirath06/pipecat.git@feat/smallest-ai-services
```

## Planned Usage (Post-Merge)

```python
from pipecat.pipeline.pipeline import Pipeline
from pipecat.services.smallest import SmallestTTSService, SmallestSTTService
from pipecat.transports.services.daily import DailyTransport

tts = SmallestTTSService(
    api_key="your-key",
    voice_id="sophia",
    model="lightning-v3.1",
)

stt = SmallestSTTService(
    api_key="your-key",
)

# Build pipeline: mic → STT → LLM → TTS → speaker
pipeline = Pipeline([transport.input(), stt, llm, tts, transport.output()])
```

## Resources

- [Pipecat Docs](https://docs.pipecat.ai/)
- [Pipecat GitHub](https://github.com/pipecat-ai/pipecat)
- [Smallest AI Docs](https://waves-docs.smallest.ai)
