# Language Translation App (Langly)

Translate text between 40+ languages and hear results spoken aloud. Type or speak input, get instant translation with Lightning TTS and Pulse STT.

## Features

- **Type or speak** — Enter text or use the mic to speak (Pulse STT)
- **40+ source languages** — Chinese, Japanese, Korean, Spanish, French, and many more
- **16 target languages** — Translate and hear results with Lightning v2/v3.1 TTS
- **Voice selector** — Choose from language-specific TTS voices
- **Copy & download** — Copy text or save audio as WAV
- **History** — Last 10 translations

## Requirements

> Base dependencies are installed via the root [`requirements.txt`](../../requirements.txt). See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

Extra dependencies:

```bash
cd text-to-speech/language-translation-app
uv pip install -r requirements.txt
```

## Usage

### 1. Backend

```bash
cd text-to-speech/language-translation-app
cp .env.sample .env
# Add your SMALLEST_API_KEY to .env

uv run uvicorn app.main:app --reload --port 8000 --app-dir backend
```

### 2. Frontend

In a separate terminal:

```bash
cd text-to-speech/language-translation-app/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Recommended Usage

- Learning pronunciation of translated phrases in your target language
- Quick translation with audio feedback for language learners
- For real-time streaming transcription, see [Realtime Microphone](../../speech-to-text/websocket/realtime-microphone-transcription/)

## Structure

```
language-translation-app/
├── .env.sample
├── requirements.txt
├── README.md
├── backend/
│   └── app/
│       ├── main.py      # FastAPI routes: translate, TTS, STT, voices
│       ├── config.py    # Language config, Lightning v2/v3.1 split
│       ├── tts.py       # Lightning TTS (v3.1 for en/hi/ta/es, v2 for others)
│       ├── stt.py       # Pulse STT
│       ├── translator.py # Google Translate via deep-translator
│       └── database.py  # SQLite history
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx      # React UI: translate, speak, mic, voice selector
        ├── App.css
        └── main.jsx
```

## How It Works

1. **Translation** — Text is sent to the backend, translated via Google (deep-translator, free), and returned.
2. **TTS** — Lightning v3.1 for English, Hindi, Tamil, Spanish; Lightning v2 for other target languages. Voices are filtered by language tag from the API.
3. **STT** — Pulse STT transcribes mic input; only languages supported by both Pulse and Lightning are enabled for speech input.

## API Reference

- [Lightning TTS](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech/overview)
- [Pulse STT](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview)

## Next Steps

- [Jarvis Voice Assistant](../../speech-to-text/websocket/jarvis/) — Always-on assistant with wake word, LLM, and TTS
- [Emotion Analyzer](../../speech-to-text/emotion-analyzer/) — Visualize speaker emotions in conversations
