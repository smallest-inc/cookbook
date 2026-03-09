# Getting Started

The simplest way to generate speech from text using Smallest AI's Lightning TTS API. This is the "hello world" of text-to-speech.

## Features

- Generate speech from text with a single API call
- Save output as WAV file
- Choose voice, speed, and language
- Uses Lightning v3.1 for highest quality output

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
| `MODEL` | TTS model | `lightning-v3.1` |
| `VOICE_ID` | Voice to use (see [Voices](../voices/)) | `sophia` |
| `SPEED` | Playback speed (0.5 to 2.0) | `1.0` |
| `SAMPLE_RATE` | Audio sample rate in Hz | `24000` |
| `LANGUAGE` | Language code (`en`, `hi`, `es`, `ta`) | `en` |
| `OUTPUT_FORMAT` | Output format (`wav`, `pcm`, `mp3`, `mulaw`) | `wav` |

## API Reference

- [Lightning v3.1 API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)

## Next Steps

- [Voices](../voices/) — Browse and preview available voices
- [Streaming](../streaming/) — Real-time audio streaming via WebSocket
- [SDK Usage](../sdk-usage/) — Use the Python SDK for cleaner code
