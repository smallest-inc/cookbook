# Voices

List and explore all available TTS voices. Filter by language, gender, and accent to find the right voice for your use case.

## Features

- List all voices for a given model
- Filter by language, gender, and accent
- Generate a preview sample for any voice
- Compare voices side by side

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

### Python

List all voices:

```bash
uv run python/voices.py
```

Filter by language and gender:

```bash
uv run python/voices.py --language english --gender female
```

Generate a preview for a specific voice:

```bash
uv run python/voices.py --preview sophia
```

### JavaScript

```bash
node javascript/voices.js
node javascript/voices.js --language english --gender female
node javascript/voices.js --preview sophia
```

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--language` | Filter by language (e.g. `english`, `hindi`) | All |
| `--gender` | Filter by gender (`male` or `female`) | All |
| `--accent` | Filter by accent (e.g. `american`, `british`, `indian`) | All |
| `--preview` | Generate a preview WAV for a voice ID | — |

## API Reference

- [Get Voices API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/get-voices-api)

## Next Steps

- [Getting Started](../getting-started/) — Generate speech with your chosen voice
- [Voice Cloning](../voice-cloning/) — Clone a custom voice from audio
