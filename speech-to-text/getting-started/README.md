# Getting Started

The simplest way to transcribe audio using Smallest AI's Pulse STT API. This is the "hello world" of speech-to-text.

## Features

- Make a basic transcription request
- Handle the API response
- Print the transcription result
- Language selection with auto-detect support

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

### Python

```bash
uv run python/transcribe.py recording.wav
```

### JavaScript

```bash
node javascript/transcribe.js recording.wav
```

## Recommended Usage

- The simplest possible transcription from an audio file — start here
- Quick validation that your API key and setup are working
- For advanced features (timestamps, diarization, emotions), [File Transcription](../file-transcription/) is recommended

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `LANGUAGE` | Language code (ISO 639-1) or `multi` for auto-detect | `en` |

## API Reference

- [Pre-recorded Quickstart](https://waves-docs.smallest.ai/models/speech-to-text/pre-recorded/quickstart)
- [Pulse STT API Reference](https://waves-docs.smallest.ai/api-reference/models/speech-to-text/transcribe)

## Next Steps

- [Word-Level Outputs](../word-level-outputs/) — Add word timestamps and speaker diarization
- [File Transcription](../file-transcription/) — Enable emotions, age, gender, PII redaction
- [Streaming Transcription](../websocket/streaming-text-output-transcription/) — Stream audio via WebSocket
