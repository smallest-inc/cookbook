# File Transcription

Transcribe audio files with advanced features like word timestamps, speaker diarization, and emotion detection.

## Features

- Transcribe audio files with language selection
- Enable advanced features (timestamps, diarization, emotion detection)
- Age and gender prediction
- Save transcription as text and JSON

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

- Transcription with paralinguistic features — emotions, age/gender detection
- Batch processing of audio/video files with detailed metadata output
- Speaker diarization and word-level timestamps on pre-recorded files
- For streaming or PII/PCI redaction, the [WebSocket API](../websocket/streaming-text-output-transcription/) is recommended

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `LANGUAGE` | Language code (ISO 639-1) or `multi` for auto-detect | `en` |
| `WORD_TIMESTAMPS` | Include word-level timestamps | `false` |
| `DIARIZE` | Perform speaker diarization | `false` |
| `AGE_DETECTION` | Predict age group of speaker | `false` |
| `GENDER_DETECTION` | Predict gender of speaker | `false` |
| `EMOTION_DETECTION` | Predict speaker emotions | `false` |

## Example Output

- `{filename}_transcript.txt` — Plain text transcription
- `{filename}_result.json` — Full API response with metadata

## API Reference

- [Pre-recorded Quickstart](https://waves-docs.smallest.ai/models/speech-to-text/pre-recorded/quickstart)
- [Pulse STT API Reference](https://waves-docs.smallest.ai/api-reference/models/speech-to-text/transcribe)

## Next Steps

- [Word-Level Outputs](../word-level-outputs/) — Focused example for timestamps and diarization
- [Subtitle Generation](../subtitle-generation/) — Generate SRT/VTT files from transcriptions
