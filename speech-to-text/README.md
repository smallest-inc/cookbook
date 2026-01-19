# Speech-to-Text

> **Powered by [Pulse STT](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview)**

Convert audio to text using Smallest AI's Lightning Speech-to-Text API. Supports 30+ languages with industry-leading accuracy and speed.

## Examples

| Example | Description |
|---------|-------------|
| [Getting Started](./getting-started/) | Basic transcription - the simplest way to get started |
| [Word-Level Outputs](./word-level-outputs/) | Word timestamps and speaker diarization |
| [Subtitle Generation](./subtitle-generation/) | Generate SRT/VTT subtitles from audio or video |
| [Podcast Summarizer](./podcast-summarizer/) | Transcribe and summarize podcasts with GPT-5 |
| [File Transcription](./file-transcription/) | Transcribe files with all advanced features |

### WebSocket Examples

| Example | Description |
|---------|-------------|
| [Streaming Transcription](./websocket/streaming-text-output-transcription/) | Stream audio files via WebSocket |
| [Realtime Microphone](./websocket/realtime-microphone-transcription/) | Gradio web UI with live microphone transcription |

## Quick Start

```bash
export SMALLEST_API_KEY="your-api-key-here"
```

Get your API key at [smallest.ai/console](https://smallest.ai/console)

## Documentation

- [Pulse STT Overview](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview)
- [Pre-recorded Audio](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/pre-recorded/quickstart)
- [Streaming Audio](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/streaming/quickstart)
- [Response Format](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/realtime/response-format)
- [API Reference](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-asr)

## Supported Languages

`en` English · `es` Spanish · `fr` French · `de` German · `hi` Hindi · `zh` Chinese · `ja` Japanese · `ko` Korean · `pt` Portuguese · `ar` Arabic · and 20+ more

Use `multi` for automatic language detection.