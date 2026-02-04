# Smallest AI Cookbook 📚

Welcome to the official Smallest AI Cookbook! This repository contains practical examples and tutorials to help you build with Smallest AI's APIs.

**For comprehensive documentation, visit [smallest.ai/docs](https://waves-docs.smallest.ai).**

---

## What's Inside

This cookbook is organized into focused modules, each demonstrating real-world use cases:

| Module | Description | Powered By |
|--------|-------------|------------|
| [Speech-to-Text](./speech-to-text/) | Transcription, subtitles, streaming, and more | [Pulse STT](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview) |
| [Voice Agents](./voice-agents/) | Voice AI agents with function calling | [Atoms SDK](https://waves-docs.smallest.ai) |

---

## Getting Started

**You'll need:**

1. A Smallest AI account
2. An API key — get one at [smallest.ai/console](https://smallest.ai/console)

**Setup:**

```bash
# Each example includes a .env.sample file
cd speech-to-text/getting-started
cp .env.sample .env
# Edit .env with your API keys

# Or export directly
export SMALLEST_API_KEY="your-api-key-here"
# any other api keys the example needs
```

---

## Speech-to-Text Examples

Convert audio and video to text with industry-leading accuracy. Supports 30+ languages.

| Example | Description |
|---------|-------------|
| [Getting Started](./speech-to-text/getting-started/) | Basic transcription — the simplest way to start |
| [Word-Level Outputs](./speech-to-text/word-level-outputs/) | Word timestamps and speaker diarization |
| [Subtitle Generation](./speech-to-text/subtitle-generation/) | Generate SRT/VTT subtitles from audio or video |
| [Meeting Notes](./speech-to-text/meeting-notes/) | Join meetings via Recall.ai, meeting notes with auto-identification of speakers by name |
| [Podcast Summarizer](./speech-to-text/podcast-summarizer/) | Transcribe and summarize with GPT-5 |
| [File Transcription](./speech-to-text/file-transcription/) | All advanced features (emotions, age, gender, PII redaction) |

### WebSocket / Streaming

| Example | Description |
|---------|-------------|
| [Streaming Transcription](./speech-to-text/websocket/streaming-text-output-transcription/) | Stream audio files via WebSocket |
| [Realtime Microphone](./speech-to-text/websocket/realtime-microphone-transcription/) | Gradio web UI with live microphone input |

---

## Voice Agents Examples

Build voice AI agents with the Atoms SDK.

### Basics

| Example | What You'll Learn |
|---------|-------------------|
| [Getting Started](./voice-agents/getting_started/) | `OutputAgentNode`, `generate_response()`, `AtomsApp` |
| [Agent with Tools](./voice-agents/agent_with_tools/) | `@function_tool`, `ToolRegistry`, tool execution |
| [Call Control](./voice-agents/call_control/) | `SDKAgentEndCallEvent`, cold/warm transfers |

### Multi-Node Patterns

| Example | What You'll Learn |
|---------|-------------------|
| [Background Agent](./voice-agents/background_agent/) | `BackgroundAgentNode`, parallel nodes, cross-node state |
| [Language Switching](./voice-agents/language_switching/) | `add_edge()`, custom nodes, event pipelines |

### Call Handling

| Example | What You'll Learn |
|---------|-------------------|
| [Inbound IVR](./voice-agents/inbound_ivr/) | Intent routing, department transfers, mute/unmute |
| [Interrupt Control](./voice-agents/interrupt_control/) | Mute/unmute events, blocking interruptions |

### Platform Features

| Example | What You'll Learn |
|---------|-------------------|
| [Knowledge Base RAG](./voice-agents/knowledge_base_rag/) | KB creation, PDF upload, URL scraping |
| [Campaigns](./voice-agents/campaigns/) | Audiences, outbound campaigns |
| [Analytics](./voice-agents/analytics/) | Call logs, transcripts, post-call metrics |

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

