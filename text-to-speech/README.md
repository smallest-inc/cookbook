# Text-to-Speech

> **Powered by [Lightning TTS](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)**

Generate natural-sounding speech from text using Smallest AI's Lightning TTS API. Supports 90+ voices across 18+ languages with real-time latency.

## Quickstart

Generate speech in under 2 minutes — no setup, no config files:

```bash
pip install requests
export SMALLEST_API_KEY="your-api-key-here"
python text-to-speech/quickstart/quickstart.py
```

Get your API key at [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys).

## Examples

### Basics

| Example | Description |
|---------|-------------|
| [Quickstart](./quickstart/) | 5-line hello world — generate speech in under 2 minutes |
| [Getting Started](./getting-started/) | Configurable synthesis with voice, speed, language, output format |
| [Voices](./voices/) | List 90+ voices, filter by language/gender/accent, preview any voice |
| [Streaming](./streaming/) | Real-time audio streaming via SSE and WebSocket |
| [Pronunciation Dicts](./pronunciation-dicts/) | Custom pronunciation for names, acronyms, and domain terms |
| [SDK Usage](./sdk-usage/) | Python SDK patterns — sync, async, and streaming |
| [Voice Cloning](./voice-cloning/) | Instant voice cloning from a short audio sample *(coming soon)* |

### Applications

| Example | Description |
|---------|-------------|
| [Multilingual Translator](./multilingual-translator/) | Hear any text spoken in 12+ languages side by side |
| [Podcast Generator](./podcast-generator/) | Give it a topic, get a two-host AI podcast (LLM + TTS) |
| [Audiobook Generator](./audiobook-generator/) | Convert any text file into a narrated, chaptered audiobook |

## Full Setup

> For all examples beyond the quickstart, run `uv venv && uv pip install -r requirements.txt` at the repo root. See the [main README](../README.md#usage).

```bash
export SMALLEST_API_KEY="your-api-key-here"
uv run text-to-speech/getting-started/python/synthesize.py "Hello from Smallest AI!"
```

Get your API key at [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys).

## Models

| Model | Sample Rate | Languages | Best For |
|-------|-------------|-----------|----------|
| **Lightning v3.1** | 44.1 kHz | en, hi, es, ta | Highest quality, production use |
| **Lightning v2** | up to 24 kHz | 18+ languages | Multilingual, widest voice selection |

## Supported Languages

**Lightning v3.1:** `en` English · `hi` Hindi · `es` Spanish · `ta` Tamil

**Lightning v2:** `en` `hi` `ta` `kn` `mr` `bn` `gu` `ar` `he` `fr` `de` `pl` `ru` `it` `nl` `es` `sv` `ml` `te`

## Output Formats

All endpoints support: `pcm` (raw), `wav`, `mp3`, `mulaw`

## Documentation

- [Lightning v3.1 REST](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)
- [Lightning v3.1 WebSocket](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1-ws)
- [Lightning v2 REST](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v2)
- [Lightning v2 WebSocket](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v2-ws)
- [Voices API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/get-voices-api)
- [Voice Cloning](https://waves-docs.smallest.ai/v4.0.0/content/api-references/voice-cloning-api)
- [Pronunciation Dicts](https://waves-docs.smallest.ai/v4.0.0/content/api-references/pronunciation-dicts-api)
- [Python SDK](https://github.com/smallest-inc/smallest-python-sdk)
