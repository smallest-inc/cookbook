# Getting Started

The simplest way to generate speech from text using Smallest AI's Lightning TTS API. This is the "hello world" of text-to-speech.

## Features

- Generate speech from text with a single API call
- Save output as WAV file
- Choose voice, speed, and language
- Uses the unified `/waves/v1/tts` route — defaults to Lightning v3.1 Pro pool, pass `MODEL="lightning_v3.1"` to use the standard pool instead

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

### Python

```bash
uv run python/synthesize.py "Hello from Smallest AI!"
```

### JavaScript

```bash
node javascript/synthesize.js "Hello from Smallest AI!"
```

Output is saved to `output.wav` in the current directory.

## Recommended Usage

- The simplest possible speech synthesis — start here
- Quick validation that your API key and setup are working
- For listing voices, see [Voices](../voices/)
- For real-time streaming, see [Streaming](../streaming/)

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `MODEL` | TTS pool (`lightning_v3.1_pro` or `lightning_v3.1`) | `lightning_v3.1_pro` |
| `VOICE_ID` | Voice to use (see [Voices](../voices/)) | `meher` |
| `SPEED` | Playback speed (0.5 to 2.0) | `1.0` |
| `SAMPLE_RATE` | Audio sample rate in Hz | `24000` |
| `LANGUAGE` | Language code (`en`, `hi`, `es`, `ta`) | `en` |
| `OUTPUT_FORMAT` | Output format (`wav`, `pcm`, `mp3`, `mulaw`) | `wav` |

## API Reference

- [Synthesize speech (unified `/waves/v1/tts`)](https://docs.smallest.ai/waves/api-reference/api-reference/text-to-speech/synthesize-speech)
- [Lightning v3.1 model card](https://docs.smallest.ai/waves/model-cards/text-to-speech/lightning-v-3-1)
- [Lightning v3.1 Pro model card](https://docs.smallest.ai/waves/model-cards/text-to-speech/lightning-v-3-1-pro)

## Next Steps

- [Voices](../voices/) — Browse and preview available voices
- [Streaming](../streaming/) — Real-time audio streaming via WebSocket
- [SDK Usage](../sdk-usage/) — Use the Python SDK for cleaner code
