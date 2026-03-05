# Multilingual Translator

Type text in any language and hear it spoken in multiple languages side by side. Generates one audio file per language so you can compare how the same content sounds across voices and accents.

## Features

- Generate speech in 18+ languages from a single input text
- Automatically picks a native voice for each language
- Outputs separate WAV files per language for easy comparison
- Supports both Lightning v3.1 (en, hi, es, ta) and v2 (18+ languages)

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
uv run python/translate.py "Hello world" --languages hindi spanish french german
```

### JavaScript

```bash
node javascript/translate.js "Welcome to the future of voice AI"
node javascript/translate.js "Hello world" --languages hindi spanish french
```

Output files are saved to a `translations/` folder.

## Supported Languages

| Language | Code | Model | Default Voice |
|----------|------|-------|---------------|
| English | `en` | v3.1 | sophia |
| Hindi | `hi` | v3.1 | advika |
| Spanish | `es` | v3.1 | camilla |
| Tamil | `ta` | v3.1 | anitha |
| French | `fr` | v2 | claire |
| German | `de` | v2 | leon |
| Italian | `it` | v2 | maria |
| Arabic | `ar` | v2 | yasmin |
| Bengali | `bn` | v2 | biswa |
| Russian | `ru` | v2 | dmitry |
| Dutch | `nl` | v2 | adriana |
| Japanese | — | — | *not yet supported* |

## API Reference

- [Lightning v3.1 API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)
- [Lightning v2 API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v2)

## Next Steps

- [Podcast Generator](../podcast-generator/) — Multi-voice AI podcast from a topic
- [Voices](../voices/) — Explore all available voices
