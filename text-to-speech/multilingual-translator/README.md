# Multilingual Translator

Type text and hear it spoken in multiple languages side by side. Generates one audio file per language so you can compare how the same content sounds across voices and accents.

## Features

- Generate speech in English, Hindi, Spanish, and Tamil from a single input
- Automatically picks a native voice for each language
- Outputs separate WAV files per language for easy comparison

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

### Python

Translate to all supported languages:

```bash
uv run python/translate.py "Welcome to the future of voice AI"
```

Pick specific languages:

```bash
uv run python/translate.py "Hello world" --languages hindi spanish
```

### JavaScript

```bash
node javascript/translate.js "Welcome to the future of voice AI"
node javascript/translate.js "Hello world" --languages hindi tamil
```

Output files are saved to a `translations/` folder.

## Supported Languages

| Language | Code | Default Voice | Accent |
|----------|------|---------------|--------|
| English | `en` | sophia | American |
| Hindi | `hi` | advika | Indian |
| Spanish | `es` | camilla | Mexican/Latin |
| Tamil | `ta` | anitha | Tamil |

## API Reference

- [Lightning v3.1 API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)

## Next Steps

- [Podcast Generator](../podcast-generator/) — Multi-voice AI podcast from a topic
- [Voices](../voices/) — Explore all available voices
