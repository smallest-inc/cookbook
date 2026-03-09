# Podcast Generator

Give it a topic and get a full AI-generated podcast with two hosts having a natural conversation. Uses an LLM to write the script and Lightning TTS to voice each host.

## Features

- Generate a two-host podcast script from any topic using GPT
- Two distinct voices (male + female) with natural conversation flow
- Concatenates all segments into a single WAV file
- Saves the script as a text file alongside the audio
- Customizable host names, voices, and conversation length

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup.

Requires both API keys in your `.env`:

```
SMALLEST_API_KEY=your-smallest-key
OPENAI_API_KEY=your-openai-key
```

## Usage

```bash
uv run generate.py "The future of AI in healthcare"
```

With custom options:

```bash
uv run generate.py "Space exploration in 2030" --exchanges 8 --host1-voice magnus --host2-voice sophia
```

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--exchanges` | Number of back-and-forth exchanges | `6` |
| `--host1-name` | Name of host 1 | `Alex` |
| `--host2-name` | Name of host 2 | `Sarah` |
| `--host1-voice` | TTS voice for host 1 | `magnus` |
| `--host2-voice` | TTS voice for host 2 | `sophia` |
| `--model` | TTS model | `lightning-v3.1` |
| `--llm` | LLM model for script generation | `gpt-4o-mini` |

## Output

```
podcast_output/
├── podcast.wav          # Full podcast audio
├── script.txt           # Generated script
├── segment_001_Alex.wav # Individual segments
├── segment_002_Sarah.wav
└── ...
```

## API Reference

- [Lightning v3.1 API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)
- [OpenAI Chat API](https://platform.openai.com/docs/api-reference/chat)

## Next Steps

- [Audiobook Generator](../audiobook-generator/) — Convert long text into a narrated audiobook
- [Voices](../voices/) — Pick different voices for your hosts
