# Streaming Transcription

Stream an audio file through the WebSocket API and capture all transcription responses.

## What You'll Learn

- Stream audio files through the WebSocket API
- Handle streaming responses (interim and final)
- Save all responses in a text file.

## Setup

```bash
export SMALLEST_API_KEY="your-api-key-here"
```

## Usage

### Python

```bash
pip install websockets librosa numpy
python python/transcribe.py audio.wav
```

### JavaScript

```bash
cd javascript && npm install
node javascript/transcribe.js audio.wav
```

## Output

- **Console**: Shows only final transcripts (`is_final=true`)
- **File**: `{filename}_responses.txt` - all transcripts as plain text

## Features

| Parameter | Description | Default |
|-----------|-------------|---------|
| `LANGUAGE` | Language code (ISO 639-1) or `multi` for auto-detect | `en` |
| `FULL_TRANSCRIPT` | Return cumulative transcript | `true` |
| `WORD_TIMESTAMPS` | Include word-level timestamps | `false` |
| `SENTENCE_TIMESTAMPS` | Include sentence-level timestamps | `false` |
| `DIARIZE` | Perform speaker diarization | `false` |
| `REDACT_PII` | Redact names, addresses | `false` |
| `REDACT_PCI` | Redact credit cards, CVV | `false` |
| `NUMERALS` | Convert spoken numbers to digits | `auto` |
| `KEYWORDS` | Keyword boosting list | `[]` |

## Response Format

Based on [Response Format documentation](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/realtime/response-format):

- `is_final=false`: Interim transcript (quick, lower accuracy)
- `is_final=true`: Final transcript for segment (accurate)
- `is_last=true`: Last response in session
