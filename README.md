![image](https://i.imgur.com/TJ2tT4g.png)   


<div align="center">
  <a href="https://twitter.com/smallest_AI">
    <img src="https://img.shields.io/twitter/url/https/twitter.com/smallest_AI.svg?style=social&label=Follow%20smallest_AI" alt="Twitter">
  <a href="https://discord.gg/ywShEyXHBW">
    <img src="https://dcbadge.vercel.app/api/server/ywShEyXHBW?style=flat" alt="Discord">
  </a>
  <a href="https://www.linkedin.com/company/smallest">
    <img src="https://img.shields.io/badge/LinkedIn-Connect-blue" alt="Linkedin">
  </a>
  <a href="https://www.youtube.com/@smallest_ai">
    <img src="https://img.shields.io/static/v1?message=smallest_ai&logo=youtube&label=&color=FF0000&logoColor=white&labelColor=&style=for-the-badge" height=20 alt="Youtube">
  </a>
</div> 

<div align="center">
  <h3>Smallest AI Cookbook</h3>
  <p>Practical, copy-paste examples for building with Smallest AI — from quick transcriptions to production voice agents.</p>
</div>

---

## Quick Links

| | |
|---|---|
| **Docs — Atoms (Voice Agents)** | [atoms-docs.smallest.ai](https://atoms-docs.smallest.ai/introduction) |
| **Docs — Waves (TTS)** | [waves-docs.smallest.ai](https://waves-docs.smallest.ai/content/introduction/introduction) |
| **API Keys** | [console.smallest.ai](https://console.smallest.ai/) |
| **Python SDK** | `pip install smallestai` &nbsp;·&nbsp; [GitHub](https://github.com/smallest-inc/smallest-python) |

---

## Table of Contents

- [Getting Started](#getting-started)
- [Voice Agents](#voice-agents)
  - [Basics](#basics)
  - [Multi-Node Patterns](#multi-node-patterns)
  - [Call Handling](#call-handling)
  - [Platform Features](#platform-features)
  - [Production Examples](#production-examples)
- [Speech-to-Text](#speech-to-text)
  - [Pre-recorded](#pre-recorded)
  - [WebSocket / Streaming](#websocket--streaming)
- [Best Practices](#best-practices)
- [Blog Code Samples](#blog-code-samples)
- [Contributing](#contributing)

---

## Getting Started

**Prerequisites**
- Python 3.9+ (all voice-agent examples) or Node.js 18+ (select STT examples)
- A Smallest AI API key — grab one at [console.smallest.ai](https://console.smallest.ai/)

**Setup**

```bash
# Install the SDK
pip install smallestai

# Export your key (used by every example)
export SMALLEST_API_KEY="your-api-key-here"

# Some examples also need an LLM key
export OPENAI_API_KEY="your-openai-key"
```

Pick any example below and follow its README to run it.

---

## Voice Agents

Build AI voice agents with the **Atoms SDK**. Each example is a self-contained project with its own `pyproject.toml` and README.

### Basics

| Example | What You'll Learn |
|---------|-------------------|
| [Getting Started](./voice-agents/getting_started/) | `OutputAgentNode`, `generate_response()`, `AtomsApp` — the bare-minimum agent |
| [Agent with Tools](./voice-agents/agent_with_tools/) | `@function_tool`, `ToolRegistry`, tool execution during a call |
| [Call Control](./voice-agents/call_control/) | `SDKAgentEndCallEvent`, cold/warm transfers, ending a call programmatically |

### Multi-Node Patterns

| Example | What You'll Learn |
|---------|-------------------|
| [Background Agent](./voice-agents/background_agent/) | `BackgroundAgentNode`, running parallel nodes, sharing state across nodes |
| [Language Switching](./voice-agents/language_switching/) | `add_edge()`, custom nodes, event pipelines for multi-language support |

### Call Handling

| Example | What You'll Learn |
|---------|-------------------|
| [Inbound IVR](./voice-agents/inbound_ivr/) | Intent routing, department transfers, mute/unmute control |
| [Interrupt Control](./voice-agents/interrupt_control/) | Mute/unmute events, blocking user interruptions during critical speech |

### Platform Features

| Example | What You'll Learn |
|---------|-------------------|
| [Knowledge Base RAG](./voice-agents/knowledge_base_rag/) | KB creation, PDF upload, URL scraping — give your agent memory |
| [Campaigns](./voice-agents/campaigns/) | Audiences, contacts, outbound campaigns at scale |
| [Analytics](./voice-agents/analytics/) | Call logs, transcript exports, post-call metrics |

### Production Examples

| Example | What You'll Learn |
|---------|-------------------|
| [Bank CSR](./voice-agents/bank_csr/) | Full banking agent — SQL queries, identity verification, FD management, audit logging via `BackgroundAgentNode` |

---

## Speech-to-Text

Convert audio and video to text using **Pulse STT**. Supports 30+ languages.

### Pre-recorded

| Example | Description |
|---------|-------------|
| [Getting Started](./speech-to-text/getting-started/) | Basic transcription — the simplest way to start |
| [Word-Level Outputs](./speech-to-text/word-level-outputs/) | Word timestamps and speaker diarization |
| [Subtitle Generation](./speech-to-text/subtitle-generation/) | Generate SRT/VTT subtitles from audio or video |
| [Online Meeting Notetaker](./speech-to-text/online-meeting-notetaking-bot/) | Join meetings via Recall.ai, auto-identify speakers by name |
| [Podcast Summarizer](./speech-to-text/podcast-summarizer/) | Transcribe and summarize podcasts with an LLM |
| [File Transcription](./speech-to-text/file-transcription/) | All advanced features — emotions, age, gender, PII redaction |
| [YouTube Summarizer](./speech-to-text/youtube-summarizer/) | Download, transcribe, and analyse YouTube videos |

### WebSocket / Streaming

| Example | Description |
|---------|-------------|
| [Streaming Transcription](./speech-to-text/websocket/streaming-text-output-transcription/) | Stream audio files to Pulse via WebSocket |
| [Realtime Microphone](./speech-to-text/websocket/realtime-microphone-transcription/) | Gradio web UI with live microphone input |

---

## Best Practices

| Guide | Description |
|-------|-------------|
| [Voice Agent Prompting Guide](./best-practices/voice_agent_prompting_guide.md) | How to write prompts that work for real-time voice — pacing, formatting, guardrails, and more |

---

## Blog Code Samples

| Sample | Description |
|--------|-------------|
| [Pulse STT Developer Guide](./blog-code-samples/pulse-stt-developer-guide/) | Companion code for the Pulse STT blog post — REST, WebSocket, and a Next.js demo app |

---

## Contributing

We love contributions! Whether it's a new example, a bug fix, or improved docs — check out [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Get Help

- [Discord Community](https://discord.gg/ywShEyXHBW)
- [Contact Support](https://smallest.ai/contact)

---

<div align="center">
  <sub>Built with care by <a href="https://smallest.ai">Smallest AI</a></sub>
</div>
