# Word-Level Outputs

Get word-level timestamps and speaker diarization for detailed analysis of your transcription.

## Usage

### Python

```bash
export SMALLEST_API_KEY="your-api-key"
python python/transcribe.py audio.wav
```

### JavaScript

```bash
export SMALLEST_API_KEY="your-api-key"
node javascript/transcribe.js audio.wav
```

## Features

| Feature | Value | Description |
|---------|-------|-------------|
| `language` | `en` | Language code (ISO 639-1) |
| `word_timestamps` | `true` | Enable word-level timestamps |
| `diarize` | `true` | Enable speaker diarization |

## Output

- Console output with transcription, utterances, and word timestamps
- `{filename}_result.json` - Full API response

## Output Format

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
