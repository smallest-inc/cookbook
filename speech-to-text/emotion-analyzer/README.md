# Emotion Analyzer

Visualize speaker emotions across a conversation. Upload any recording and see who said what — and how they felt saying it — powered by Smallest AI Pulse STT emotion detection.

## Demo

![Demo](demo/demo.gif)

## Features

- Upload audio and get a diarized transcript with per-segment emotion scores
- Interactive timeline chart with one line per speaker–emotion combination
- Color-coded emotion filters (happiness, sadness, anger, fear, disgust)
- Speaker filters with dash-style line indicators
- Concurrent emotion detection for fast results on long recordings

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

Extra dependencies:

```bash
uv pip install -r requirements.txt
```

## Usage

```bash
uv run backend/app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

1. Drop or select an audio file
2. Click **Analyze Emotions**
3. Explore the results — emotion timeline, speaker filters, and full transcript table

## Recommended Usage

- Analyzing tone and sentiment shifts across a multi-speaker conversation
- Comparing emotional patterns between speakers over time
- For basic emotion scores without visualization, [File Transcription](../file-transcription/) supports `emotion_detection=true` directly

## Structure

```
emotion-analyzer/
├── .env.sample          # Environment variable template
├── requirements.txt     # Extra Python dependencies (flask, pydub)
├── README.md
├── backend/
│   └── app.py           # Flask backend — upload, diarize, merge, split, emotion detect
└── frontend/
    ├── index.html       # Minimal HTML shell
    ├── app.js           # UI logic
    └── style.css        # Styles and theming
```

## How It Works

1. **Upload** — the Flask backend receives an audio file via `/api/analyze`
2. **Diarize** — sends the full audio to Pulse STT with `diarize=true` and `word_timestamps=true`, getting speaker-labeled utterances
3. **Merge** — utterances sharing the same timestamp and speaker are merged into single segments
4. **Split** — pydub slices the original audio at utterance boundaries into per-segment WAV clips
5. **Detect emotions** — each segment is sent to Pulse STT with `emotion_detection=true` concurrently (up to 10 workers)
6. **Visualize** — the frontend renders an interactive Chart.js timeline with emotion/speaker filter chips and a transcript table

## Supported Formats

Audio: WAV, MP3, FLAC, OGG, M4A, AAC, WMA

## API Reference

- [Pulse STT Overview](https://waves-docs.smallest.ai/models/speech-to-text/overview)
- [Emotion Detection](https://waves-docs.smallest.ai/models/speech-to-text/features/emotion-detection)
- [Pre-recorded API](https://waves-docs.smallest.ai/models/speech-to-text/pre-recorded/quickstart)

## Next Steps

- [Realtime Microphone](../websocket/realtime-microphone-transcription/) — Live microphone transcription via WebSocket
