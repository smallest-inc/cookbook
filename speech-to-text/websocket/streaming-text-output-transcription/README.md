# Streaming Transcription

Stream an audio file through the WebSocket API and capture all transcription responses — both interim (partial) and final.

## Features

- Stream audio files through the WebSocket API
- Handle streaming responses (interim and final)
- Configurable language, diarization, PII/PCI redaction, and more
- Save all responses to a text file

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

Extra dependencies:

```bash
uv pip install -r requirements.txt
```

This installs `librosa` and `numpy` for audio processing.

## Usage

### Python

```bash
uv run python/transcribe.py audio.wav
```

### JavaScript

```bash
cd javascript && npm install
node javascript/transcribe.js audio.wav
```

## Recommended Usage

- Streaming a pre-recorded audio file through the WebSocket API with interim + final transcripts
- PII/PCI redaction, keyword boosting, and other streaming-only features
- For live microphone input, [Realtime Microphone](../realtime-microphone-transcription/) is recommended

## Key Snippets

The script reads an audio file, resamples it to 16kHz mono PCM, and streams it in chunks over a WebSocket connection. The API returns interim transcripts (fast, lower accuracy) and final transcripts (accurate) as the audio streams in.

```python
async with websockets.connect(ws_url) as ws:
    # Send audio in chunks
    for i in range(0, len(audio_bytes), chunk_size):
        await ws.send(audio_bytes[i:i + chunk_size])
    
    # Signal end of audio
    await ws.send(json.dumps({"eof": True}))
    
    # Receive transcripts
    async for message in ws:
        data = json.loads(message)
        if data.get("is_final"):
            print(data["transcript"])
```

## Configuration

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

## Example Output

- **Console**: Shows only final transcripts (`is_final=true`)
- **File**: `{filename}_responses.txt` — all transcripts as plain text

### Response Format

Based on [Response Format documentation](https://waves-docs.smallest.ai/models/speech-to-text/realtime-web-socket/response-format):

- `is_final=false`: Interim transcript (quick, lower accuracy)
- `is_final=true`: Final transcript for segment (accurate)
- `is_last=true`: Last response in session

## API Reference

- [Streaming Quickstart](https://waves-docs.smallest.ai/models/speech-to-text/realtime-web-socket/quickstart)
- [Response Format](https://waves-docs.smallest.ai/models/speech-to-text/realtime-web-socket/response-format)
- [Pulse STT WebSocket API](https://waves-docs.smallest.ai/api-reference/models/speech-to-text/speech-to-text)

## Next Steps

- [Realtime Microphone](../realtime-microphone-transcription/) — Live microphone transcription with a Gradio web UI
- [Jarvis Voice Assistant](../jarvis/) — Full voice assistant with wake word, LLM, and TTS
