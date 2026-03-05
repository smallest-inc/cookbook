# Voice Cloning

> **Coming Soon** — Instant voice cloning examples are under development and will be added shortly.

Clone any voice from a short audio sample (5–15 seconds) and use it for text-to-speech synthesis.

## Planned Examples

- **Instant Clone** — Upload a short audio clip, get a usable voice ID back
- **Clone and Speak** — End-to-end: clone a voice then synthesize speech with it
- **Manage Cloned Voices** — List, preview, and delete your cloned voices

## API Reference

- [Voice Cloning API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/voice-cloning-api)
- [Python SDK — add_voice()](https://github.com/smallest-inc/smallest-python-sdk)

## In the Meantime

You can clone voices today via the [Smallest AI platform](https://app.smallest.ai) or the Python SDK:

```python
from smallestai.waves import WavesClient

client = WavesClient(api_key="YOUR_API_KEY")
voice = client.add_voice("My Custom Voice", "sample.wav")
print(f"Voice ID: {voice}")
```
