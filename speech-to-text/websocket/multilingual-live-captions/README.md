# Multilingual Live Captions

Auto-detect spoken language, translate on the fly, and preview SRT captions for live events or streams.

## Features

- Automatic language detection (`language=multi`) with Pulse STT
- Live translation to a chosen subtitle language
- Instant SRT preview you can copy into players/overlays
- Works from your microphone via WebSocket streaming

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

Extra dependencies:

```bash
uv pip install -r requirements.txt
```

This installs `numpy` (used for lightweight resampling). Translation uses OpenAI if `OPENAI_API_KEY` is set; otherwise it falls back to source text.

## Usage

```bash
uv run app.py
```

Then open http://localhost:7860 and:

1. Choose subtitle language (e.g., English)
2. Click microphone and speak — transcript + translation update live
3. Copy SRT preview into your caption tool or player
4. Click **Stop & Clear** to reset

## Recommended Usage

- Live captions for multilingual events or webinars
- Streaming overlays that need translated subtitles quickly
- As a building block for hybrid ASR + translation caption services

## How It Works

- Streams mic audio to Pulse STT over WebSocket with `language=multi`
- Receives partial/final transcripts with detected language metadata
- Runs on-the-fly translation via OpenAI (if configured)
- Accumulates segments and renders an SRT preview for copy/paste

## Configuration

| Setting           | Default   | Description                                                   |
| ----------------- | --------- | ------------------------------------------------------------- |
| `language`        | `multi`   | Enables automatic language detection                          |
| Subtitle dropdown | `English` | Target translation language (`Same as source` keeps original) |
| Sample rate       | 16000 Hz  | Resampled client-side if needed                               |

## Example Output (SRT)

```
1
00:00:00,000 --> 00:00:03,400
Welcome to the live demo.

2
00:00:03,400 --> 00:00:06,200
Here are your translated captions.
```

## API Reference

- [Streaming Quickstart](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/streaming/quickstart)
- [Pulse STT WebSocket API](https://waves-docs.smallest.ai/content/api-references/pulse-stt-ws)

## Next Steps

- [Realtime Microphone Transcription](../realtime-microphone-transcription/) — Basic live STT without translation
- [Jarvis Voice Assistant](../jarvis/) — Full assistant with wake word, LLM, and TTS
