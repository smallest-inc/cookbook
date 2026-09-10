# Word-Level Outputs

Get word-level timestamps and speaker diarization for detailed analysis of your transcription.

## Features

- Word-level start/end timestamps for every word
- Speaker diarization — know who said what
- Utterance grouping by speaker
- JSON output with full metadata

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

### Python

```bash
uv run python/transcribe.py audio.wav
```

### JavaScript

```bash
node javascript/transcribe.js audio.wav
```

## Recommended Usage

- When you need to know exactly when each word was spoken or who said what
- Meeting transcription, closed captions, audio analytics with speaker diarization
- For subtitle file generation, [Subtitle Generation](../subtitle-generation/) is recommended

## How It Works

The API is called with `word_timestamps=true` and `diarize=true`. The response includes:

### Utterances (Speaker Diarization)

Each utterance groups words by speaker:

```json
{
  "speaker": "speaker_0",
  "start": 0.0,
  "end": 2.5,
  "text": "Hello, how are you?"
}
```

### Word Timestamps

Each word includes timing and optional speaker info:

```json
{
  "word": "hello",
  "start": 0.0,
  "end": 0.45,
  "speaker": "speaker_0"
}
```

## Configuration

| Feature | Value | Description |
|---------|-------|-------------|
| `language` | `en` | Language code (ISO 639-1) |
| `word_timestamps` | `true` | Enable word-level timestamps |
| `diarize` | `true` | Enable speaker diarization |

## Example Output

- Console output with transcription, utterances, and word timestamps
- `{filename}_result.json` — Full API response

## API Reference

- [Pre-recorded Quickstart](https://waves-docs.smallest.ai/models/speech-to-text/pre-recorded/quickstart)
- [Response Format](https://waves-docs.smallest.ai/models/speech-to-text/realtime-web-socket/response-format)
- [Pulse STT API Reference](https://waves-docs.smallest.ai/api-reference/models/speech-to-text/transcribe)

## Next Steps

- [Subtitle Generation](../subtitle-generation/) — Turn word timestamps into SRT/VTT subtitle files
- [File Transcription](../file-transcription/) — Add emotions, age, gender detection
