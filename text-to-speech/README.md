# Text-to-Speech

> **Powered by [Lightning TTS v3.1](https://docs.smallest.ai/waves/model-cards/text-to-speech/lightning-v-3-1) and the new [Lightning v3.1 Pro](https://docs.smallest.ai/waves/model-cards/text-to-speech/lightning-v-3-1-pro) pool.**

Generate natural-sounding speech from text using Smallest AI's Lightning TTS API. 80+ voices on standard Lightning v3.1, plus a curated Pro voice catalog across American, British, and Indian accents. 44.1 kHz native sample rate, ~200ms latency.

## Try It Now (Zero Install)

```bash
curl -X POST https://api.smallest.ai/waves/v1/tts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Smallest AI!", "voice_id": "meher", "model": "lightning_v3.1_pro", "sample_rate": 24000, "output_format": "wav"}' \
  --output hello.wav
```

Drop the `model` field (or set it to `"lightning_v3.1"`) to use the standard pool — that pool has more voices, the full 12-language catalog, plus voice cloning. The unified `/waves/v1/tts` route serves both.

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
| [Voice Explorer](./voice-explorer/) | Interactive browser to preview all voices, search by use case or emotion, and play audio inline |
| [News Voice App](./news-voice-app/) | Web dashboard that groups headlines into story clusters and plays each as a 2-3 min audio summary |
| [Language Translation App](./language-translation-app/) | Translate text between 40+ languages with TTS and STT — type or speak input, hear results spoken aloud |

## Full Setup

> For all examples beyond the quickstart, run `uv venv && uv pip install -r requirements.txt` at the repo root. See the [main README](../README.md#usage).

```bash
export SMALLEST_API_KEY="your-api-key-here"
uv run text-to-speech/getting-started/python/synthesize.py "Hello from Smallest AI!"
```

## Supported Languages

Standard Lightning v3.1: `en` English · `hi` Hindi · `mr` Marathi · `kn` Kannada · `ta` Tamil · `bn` Bengali · `gu` Gujarati · `te` Telugu · `ml` Malayalam · `pa` Punjabi · `or` Odia · `es` Spanish · `auto`

Lightning v3.1 Pro: depends on the voice — Indian Pro voices speak `en` + `hi`; British and American Pro voices speak `en`. Query `GET /waves/v1/lightning-v3.1/get_voices` and read `tags.language` for the source of truth.

## Output Formats

`pcm` (raw) · `wav` · `mp3` · `mulaw`

## Documentation

- [Lightning v3.1 REST](https://docs.smallest.ai/waves/api-reference/api-reference/text-to-speech/synthesize-speech)
- [Lightning v3.1 WebSocket](https://docs.smallest.ai/waves/api-reference/api-reference/text-to-speech/synthesize-speech-ws)
- [Voices API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/get-voices-api)
- [Voice Cloning](https://waves-docs.smallest.ai/v4.0.0/content/api-references/voice-cloning-api)
- [Pronunciation Dicts](https://waves-docs.smallest.ai/v4.0.0/content/api-references/pronunciation-dicts-api)
- [Python SDK](https://github.com/smallest-inc/smallest-python-sdk)
