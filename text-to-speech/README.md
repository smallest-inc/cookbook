# Text-to-Speech

> **Powered by [Lightning TTS v3.1](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)**

Generate natural-sounding speech from text using Smallest AI's Lightning TTS API. 80+ voices, 44.1 kHz native sample rate, ~200ms latency.

## Try It Now (Zero Install)

```bash
curl -X POST https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Smallest AI!", "voice_id": "sophia", "sample_rate": 24000, "output_format": "wav"}' \
  --output hello.wav
```

Get your API key at [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys).

## Quickstart

Generate speech in under 2 minutes — no setup, no config files:

```bash
pip install requests
export SMALLEST_API_KEY="your-api-key-here"
python text-to-speech/quickstart/quickstart.py
```

## Examples

### Basics

| Example | Description |
|---------|-------------|
| [Quickstart](./quickstart/) | 5-line hello world — generate speech in under 2 minutes |
| [Getting Started](./getting-started/) | Configurable synthesis with voice, speed, language, output format |
| [Voices](./voices/) | List 80+ voices, filter by language/gender/accent, preview any voice |
| [Streaming](./streaming/) | Real-time audio streaming via SSE and WebSocket |
| [Pronunciation Dicts](./pronunciation-dicts/) | Custom pronunciation for names, acronyms, and domain terms |
| [SDK Usage](./sdk-usage/) | Python SDK patterns *(coming soon — SDK does not yet support v3.1)* |
| [Voice Cloning](./voice-cloning/) | Instant voice cloning from a short audio sample *(coming soon)* |

### Expressive TTS (v3.2)

| Example | Description |
|---------|-------------|
| [Expressive TTS](./expressive-tts/) | Control emotion, pitch, volume, accent — make the same voice happy, angry, whispering, sarcastic |
| [Chinese Whispers Game](./voice-chinese-whispers/) | Same sentence through 5 characters with different emotions/accents — viral shareable demo |

### Web Apps (Deploy to Vercel)

| Example | Description |
|---------|-------------|
| [Voice Gallery App](./voice-gallery-app/) | Browse, filter, preview 80+ voices in a web UI. One-click deploy to Vercel. |

### Applications

| Example | Description |
|---------|-------------|
| [Multilingual Translator](./multilingual-translator/) | Hear any text spoken in English, Hindi, Spanish, and Tamil side by side |
| [Podcast Generator](./podcast-generator/) | Give it a topic, get a two-host AI podcast (LLM + TTS) |
| [Audiobook Generator](./audiobook-generator/) | Convert any text file into a narrated, chaptered audiobook |

## Full Setup

> For all examples beyond the quickstart, run `uv venv && uv pip install -r requirements.txt` at the repo root. See the [main README](../README.md#usage).

```bash
export SMALLEST_API_KEY="your-api-key-here"
uv run text-to-speech/getting-started/python/synthesize.py "Hello from Smallest AI!"
```

## Supported Languages

`en` English · `hi` Hindi · `es` Spanish · `ta` Tamil

## Output Formats

`pcm` (raw) · `wav` · `mp3` · `mulaw`

## Documentation

- [Lightning v3.1 REST](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)
- [Lightning v3.1 WebSocket](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1-ws)
- [Voices API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/get-voices-api)
- [Voice Cloning](https://waves-docs.smallest.ai/v4.0.0/content/api-references/voice-cloning-api)
- [Pronunciation Dicts](https://waves-docs.smallest.ai/v4.0.0/content/api-references/pronunciation-dicts-api)
- [Python SDK](https://github.com/smallest-inc/smallest-python-sdk)
