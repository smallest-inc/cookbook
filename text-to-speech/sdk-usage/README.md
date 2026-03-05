# SDK Usage

Use the official Smallest AI Python SDK for cleaner, more Pythonic text-to-speech. Covers sync, async, and streaming patterns.

## Features

- **Sync synthesis** — Simple blocking call, best for scripts and CLIs
- **Async synthesis** — Non-blocking, ideal for web servers and async pipelines
- **Streaming** — WebSocket-based streaming for real-time audio delivery
- **Utility methods** — List voices, get languages, manage cloned voices

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

The `smallestai` package is included in the root `requirements.txt`.

## Usage

### Sync, async, and streaming all in one script:

```bash
uv run sdk_examples.py
```

### Run individual patterns:

```bash
uv run sdk_examples.py --sync          # Sync synthesis only
uv run sdk_examples.py --async         # Async synthesis only
uv run sdk_examples.py --streaming     # Streaming only
uv run sdk_examples.py --voices        # List voices
```

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `MODEL` | TTS model (SDK currently supports `lightning-v2`) | `lightning-v2` |
| `VOICE_ID` | Voice to use | `ashley` |
| `SAMPLE_RATE` | Audio sample rate in Hz | `24000` |

> **Important:** The Python SDK currently supports `lightning`, `lightning-large`, and `lightning-v2`. For `lightning-v3.1`, use the REST or WebSocket API directly (see [Getting Started](../getting-started/) or [Streaming](../streaming/)).
>
> **Voice IDs are model-specific.** Lightning v3.1 and v2 have completely different voice catalogs. A voice ID from v2 (e.g. `ashley`) will not work with v3.1, and vice versa (e.g. `sophia` is v3.1 only). The `--voices` flag lists voices for both models so you can see the difference.

## API Reference

- [Python SDK on GitHub](https://github.com/smallest-inc/smallest-python-sdk)
- [Lightning v2 API](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v2)

## Next Steps

- [Streaming](../streaming/) — Direct WebSocket/SSE streaming (supports all models)
- [Getting Started](../getting-started/) — Direct REST API usage (supports all models)
