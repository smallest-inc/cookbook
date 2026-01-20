# Smallest AI Cookbook 📚

Welcome to the official Smallest AI Cookbook! This repository contains practical examples and tutorials to help you build with Smallest AI's APIs.

**For comprehensive documentation, visit [smallest.ai/docs](https://waves-docs.smallest.ai).**

---

## What's Inside

This cookbook is organized into focused modules, each demonstrating real-world use cases:

| Module | Description | Powered By |
|--------|-------------|------------|
| [Speech-to-Text](./speech-to-text/) | Transcription, subtitles, streaming, and more | [Pulse STT](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview) |
| [Atoms](./atoms/) | Voice AI agents with function calling | [Atoms SDK](https://waves-docs.smallest.ai) |

---

## Getting Started

**You'll need:**

1. A Smallest AI account
2. An API key — get one at [smallest.ai/console](https://smallest.ai/console)

```bash
export SMALLEST_API_KEY="your-api-key-here"
```

---

## Speech-to-Text Examples

Convert audio and video to text with industry-leading accuracy. Supports 30+ languages.

| Example | Description |
|---------|-------------|
| [Getting Started](./speech-to-text/getting-started/) | Basic transcription — the simplest way to start |
| [Word-Level Outputs](./speech-to-text/word-level-outputs/) | Word timestamps and speaker diarization |
| [Subtitle Generation](./speech-to-text/subtitle-generation/) | Generate SRT/VTT subtitles from audio or video |
| [Podcast Summarizer](./speech-to-text/podcast-summarizer/) | Transcribe and summarize with GPT-4o |
| [File Transcription](./speech-to-text/file-transcription/) | All advanced features (emotions, age, gender, PII redaction) |

### WebSocket / Streaming

| Example | Description |
|---------|-------------|
| [Streaming Transcription](./speech-to-text/websocket/streaming-text-output-transcription/) | Stream audio files via WebSocket |
| [Realtime Microphone](./speech-to-text/websocket/realtime-microphone-transcription/) | Gradio web UI with live microphone input |

---

## Atoms Examples

Build voice AI agents that can make calls, use tools, and handle complex conversations.

| Example | Description |
|---------|-------------|
| [Getting Started](./atoms/getting_started/) | SDK setup and outbound calls |
| [Agent with Tools](./atoms/agent_with_tools/) | Custom function calling |
| [Call Control](./atoms/call_control/) | End calls, transfer to humans |

---

## Language Support

Each example includes implementations in:

- **Python** — Uses `requests`, `websockets`, and standard libraries
- **JavaScript** — Uses `node-fetch`, `ws`, and Node.js built-ins

## Contributing

Contributions are welcome! If you'd like to add a new example:

1. Create a folder with a descriptive name
2. Add implementations in `python/` and/or `javascript/` subdirectories
3. Include a `README.md` explaining what it does and how to run it
4. Update this root README with your new example

---

## Get Help

- [Discord Community](https://discord.gg/5evETqguJs)
- [Contact Support](https://smallest.ai/contact)

---

Thank you for building with Smallest AI! We're excited to see what you create. 🚀

