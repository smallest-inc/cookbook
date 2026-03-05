# Streaming

Real-time audio streaming for low-latency text-to-speech. Supports Server-Sent Events (SSE) and WebSocket protocols.

## Features

- **SSE streaming** — Receive audio chunks via HTTP streaming as they're generated
- **WebSocket streaming** — Bidirectional connection for real-time, chunk-by-chunk audio delivery
- Save streamed audio to WAV file
- Measure time-to-first-byte latency

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

Additional dependencies:

```bash
uv pip install -r requirements.txt
```

## Usage

### Python — SSE Streaming

```bash
uv run python/stream_sse.py "This text will be streamed as audio in real-time."
```

### Python — WebSocket Streaming

```bash
uv run python/stream_ws.py "This text will be streamed via WebSocket."
```

### JavaScript — SSE Streaming

```bash
node javascript/stream_sse.js "This text will be streamed as audio in real-time."
```

### JavaScript — WebSocket Streaming

```bash
cd javascript && npm install   # installs 'ws' package
node stream_ws.js "This text will be streamed via WebSocket."
```

## SSE vs WebSocket

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Protocol | HTTP POST | `wss://` |
| Direction | Server → Client | Bidirectional |
| Best for | Simple streaming | Real-time conversations, LLM pipelines |
| Chunking | 1024-byte base64 chunks | Binary audio chunks |
| Connection reuse | No (one request = one connection) | Yes (send multiple texts on one connection) |

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `MODEL` | TTS model | `lightning-v3.1` |
| `VOICE_ID` | Voice to use | `sophia` |
| `SAMPLE_RATE` | Audio sample rate in Hz | `24000` |
| `SPEED` | Playback speed (0.5–2.0) | `1.0` |

## API Reference

- [Lightning v3.1 SSE Streaming](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)
- [Lightning v3.1 WebSocket](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1-ws)

## Next Steps

- [SDK Usage](../sdk-usage/) — Use the Python SDK's built-in streaming support
- [Getting Started](../getting-started/) — Non-streaming synthesis for simpler use cases
