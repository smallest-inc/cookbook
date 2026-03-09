# Audiobook Generator

Convert any text file into a narrated audiobook. Splits long text into chapters, generates audio for each, and combines them into a single file.

## Features

- Read text from a file or stdin
- Automatically split into chapters by paragraph breaks or custom markers
- Generate audio with a consistent narrator voice
- Combine all chapters into a single WAV file
- Individual chapter files saved for easy navigation

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

From a text file:

```bash
uv run generate.py story.txt
```

With custom options:

```bash
uv run generate.py story.txt --voice magnus --speed 0.9 --chapter-marker "---"
```

From inline text (for quick testing):

```bash
uv run generate.py --text "Once upon a time, in a land far away, there lived a curious inventor."
```

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--voice` | Narrator voice | `sophia` |
| `--speed` | Narration speed (0.5–2.0) | `1.0` |
| `--model` | TTS model | `lightning-v3.1` |
| `--chapter-marker` | Text that separates chapters | `---` |
| `--max-chunk` | Max characters per API call | `500` |
| `--text` | Inline text instead of file | — |

## Output

```
audiobook_output/
├── audiobook.wav        # Full audiobook
├── chapter_01.wav       # Individual chapters
├── chapter_02.wav
└── ...
```

## Tips

- For best results, use clear paragraph breaks in your text
- The `--chapter-marker` flag lets you control exactly where chapters split
- Long paragraphs are automatically chunked (max 500 chars) for reliable synthesis
- Use `--speed 0.9` for a more relaxed narration pace

## API Reference

- [Lightning v3.1 API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)

## Next Steps

- [Podcast Generator](../podcast-generator/) — Multi-voice conversation from a topic
- [Voices](../voices/) — Pick the perfect narrator voice
