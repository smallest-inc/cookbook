# Text-to-Speech

> **Powered by [Lightning TTS](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech/overview)**

Convert text to natural-sounding speech using Smallest AI's Lightning TTS API. Supports 16+ languages with Lightning v2 and v3.1, with language-specific voices.

## Examples

| Example | Description |
|---------|-------------|
| [Language Translation App](./language-translation-app/) | Translate text between 40+ languages with TTS and STT — type or speak input, hear results spoken aloud |

## Quick Start

> **Prerequisites:** Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root. See the [main README](../README.md#usage) for full setup.

```bash
cd text-to-speech/language-translation-app
cp .env.sample .env
# Add your SMALLEST_API_KEY to .env

uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000 --app-dir backend
```

In a separate terminal, run the frontend:

```bash
cd text-to-speech/language-translation-app/frontend
npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Documentation

- [Lightning TTS Overview](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech/overview)
- [Lightning v3.1](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech-new/overview) — English, Hindi, Tamil, Spanish
- [Lightning v2](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v2) — Additional languages
