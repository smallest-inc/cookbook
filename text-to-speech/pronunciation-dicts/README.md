# Pronunciation Dictionaries

Control how specific words are spoken using custom pronunciation dictionaries. Useful for names, acronyms, technical terms, and brand names.

## Features

- Create a pronunciation dictionary with custom word–pronunciation pairs
- Use the dictionary when generating speech
- List, update, and delete dictionaries
- Compare output with and without custom pronunciation

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

### Python

Create a dictionary, synthesize speech with it, then clean up:

```bash
uv run python/pronunciation.py
```

### JavaScript

```bash
node javascript/pronunciation.js
```

## How It Works

1. **Create** a pronunciation dictionary with word–pronunciation pairs
2. **Synthesize** speech, passing the dictionary ID in `pronunciation_dicts`
3. The TTS engine uses your custom pronunciations instead of defaults
4. **Clean up** by deleting the dictionary when no longer needed

## Example Pairs

| Word | Pronunciation | Use Case |
|------|---------------|----------|
| `API` | `ay pee eye` | Acronyms |
| `GIF` | `jiff` | Contested pronunciations |
| `Kubernetes` | `koo-ber-net-eez` | Technical terms |
| `Diya` | `dee-yah` | Names |

## API Reference

- [Pronunciation Dicts API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/pronunciation-dicts-api)

## Next Steps

- [Getting Started](../getting-started/) — Basic speech synthesis
- [Voices](../voices/) — Choose the right voice for your use case
