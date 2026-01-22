# File Transcription

Transcribe audio files with advanced features like word timestamps, speaker diarization, and emotion detection.

## What You'll Learn

- Transcribe audio files with language selection
- Enable advanced features (timestamps, diarization, emotion detection)
- Save transcription as text and JSON

## Setup

```bash
export SMALLEST_API_KEY="your-api-key-here"
```

## Usage

### Python

```bash
pip install requests
python python/transcribe.py recording.wav
```

### JavaScript

```bash
node javascript/transcribe.js recording.wav
```

## Features

| Parameter | Description | Default |
|-----------|-------------|---------|
| `LANGUAGE` | Language code (ISO 639-1) or `multi` for auto-detect | `en` |
| `WORD_TIMESTAMPS` | Include word-level timestamps | `false` |
| `DIARIZE` | Perform speaker diarization | `false` |
| `AGE_DETECTION` | Predict age group of speaker | `false` |
| `GENDER_DETECTION` | Predict gender of speaker | `false` |
| `EMOTION_DETECTION` | Predict speaker emotions | `false` |

## Output Files

- `{filename}_transcript.txt` - Plain text transcription
- `{filename}_result.json` - Full API response with metadata
