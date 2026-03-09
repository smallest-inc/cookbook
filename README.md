![Smallest AI](assets/smallest-banner.png)

<div align="center">
  <a href="https://twitter.com/smallest_AI">
    <img src="https://img.shields.io/twitter/url/https/twitter.com/smallest_AI.svg?style=social&label=Follow%20smallest_AI" alt="Twitter">
  </a>
  <a href="https://discord.gg/ywShEyXHBW">
    <img src="https://img.shields.io/discord/1212257329559642112?style=flat&logo=discord&logoColor=white&label=Discord&color=5865F2" alt="Discord">
  </a>
  <a href="https://www.linkedin.com/company/smallest">
    <img src="https://img.shields.io/badge/LinkedIn-Connect-blue" alt="LinkedIn">
  </a>
  <a href="https://www.youtube.com/@smallest_ai">
    <img src="https://img.shields.io/static/v1?message=smallest_ai&logo=youtube&label=&color=FF0000&logoColor=white&labelColor=&style=for-the-badge" height=20 alt="YouTube">
  </a>
</div>

# Smallest AI Cookbook

Smallest AI offers an end-to-end Voice AI suite for developers building real-time voice agents. You can use our Speech-to-Text APIs through Pulse STT for high-accuracy transcription, our Text-to-Speech APIs through Lightning TTS for natural-sounding speech synthesis, or use the Atoms Client to build and operate enterprise-ready Voice Agents with features like tool calling, knowledge bases, and campaign management.

This cookbook contains practical examples and tutorials for building with Smallest AI's APIs. Each example is self-contained and demonstrates a real-world use case — from basic transcription to fully autonomous voice agents.

**Documentation:** [Waves (STT & TTS)](https://waves-docs.smallest.ai) · [Atoms (Voice Agents)](https://atoms-docs.smallest.ai/dev) · [Python SDK](https://github.com/smallest-inc/smallest-python-sdk)

---

## Try It Now (30 Seconds)

```bash
curl -X POST https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Smallest AI!", "voice_id": "sophia", "sample_rate": 24000, "output_format": "wav"}' \
  --output hello.wav
```

Replace `YOUR_API_KEY` with your key from [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys). That's it — you'll have audio in 2 seconds.

---

## Usage

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Python >= 3.10 (install via `uv python install 3.13` if needed)
- A Smallest AI API key — get one at [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys)

### Quick Start

Clone the repo, set up a virtual environment, and install the shared dependencies:

```bash
git clone https://github.com/smallest-inc/cookbook.git
cd cookbook
uv venv && uv pip install -r requirements.txt
```

### Set up your API key

Each example reads keys from the environment. The easiest way is to copy the `.env.sample` included in every example directory:

```bash
cd speech-to-text/getting-started
cp .env.sample .env
# Add your keys to .env
```

Or export directly in your shell:

```bash
export SMALLEST_API_KEY="your-api-key-here"
```

### Run an example

```bash
uv run speech-to-text/getting-started/python/transcribe.py recording.wav
```

Some examples need additional dependencies beyond the root `requirements.txt`. Each one has its own `requirements.txt` — install before running:

```bash
uv pip install -r speech-to-text/websocket/jarvis/requirements.txt
uv run speech-to-text/websocket/jarvis/jarvis.py
```

For voice agent examples:

```bash
uv pip install -r voice-agents/bank_csr/requirements.txt
uv run voice-agents/bank_csr/app.py
```

### API Keys

- `SMALLEST_API_KEY` — [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys) — Required by all examples
- `OPENAI_API_KEY` — [platform.openai.com](https://platform.openai.com/api-keys) — Podcast Summarizer, Meeting Notes, Voice Agents
- `GROQ_API_KEY` — [console.groq.com](https://console.groq.com) — YouTube Summarizer, Jarvis
- `RECALL_API_KEY` — [recall.ai](https://recall.ai) — Meeting Notes

---

## Speech-to-Text Examples

Convert audio and video to text with industry-leading accuracy. Supports 30+ languages with features like speaker diarization, word timestamps, and emotion detection. Powered by [Pulse STT](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview).

- [Getting Started](./speech-to-text/getting-started/) — Basic transcription, the simplest way to start
- [Jarvis Voice Assistant](./speech-to-text/websocket/jarvis/) — Always-on assistant with wake word detection, LLM reasoning, and TTS
- [Online Meeting Notetaker](./speech-to-text/online-meeting-notetaking-bot/) — Join Google Meet / Zoom / Teams via Recall.ai, auto-identify speakers by name, generate structured notes
- [Podcast Summarizer](./speech-to-text/podcast-summarizer/) — Transcribe and summarize podcasts with key takeaways using GPT
- [Emotion Analyzer](./speech-to-text/emotion-analyzer/) — Visualize speaker emotions across a conversation with interactive charts

**[See all Speech-to-Text examples &rarr;](./speech-to-text/)**

---

## Text-to-Speech Examples

Generate natural-sounding speech from text with real-time latency. 80+ voices across 4 languages (en, hi, es, ta) with 44.1 kHz quality and ~200ms latency. Powered by [Lightning TTS v3.1](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1).

- [Quickstart](./text-to-speech/quickstart/) — Generate speech in 5 lines of code, under 2 minutes
- [Getting Started](./text-to-speech/getting-started/) — Configurable synthesis with voice, speed, language, output format
- [Voices](./text-to-speech/voices/) — List and preview 80+ voices, filter by language, gender, and accent
- [Streaming](./text-to-speech/streaming/) — Real-time audio streaming via SSE and WebSocket
- [Pronunciation Dicts](./text-to-speech/pronunciation-dicts/) — Custom pronunciation for names, acronyms, and domain terms
- [Multilingual Translator](./text-to-speech/multilingual-translator/) — Hear text spoken in English, Hindi, Spanish, and Tamil side by side
- [Podcast Generator](./text-to-speech/podcast-generator/) — AI podcast from a topic — LLM writes the script, TTS voices the hosts
- [Audiobook Generator](./text-to-speech/audiobook-generator/) — Convert any text file into a narrated, chaptered audiobook
- [Voice Gallery App](./text-to-speech/voice-gallery-app/) — Web app to browse & preview all voices — [deploy to Vercel](./text-to-speech/voice-gallery-app/)
- [Expressive TTS](./text-to-speech/expressive-tts/) — Control emotion, pitch, volume, accent (v3.2) + auto-detect with LLM
- [Chinese Whispers](./text-to-speech/voice-chinese-whispers/) — Same sentence, 5 characters, wildly different emotions — viral demo

**[See all Text-to-Speech examples &rarr;](./text-to-speech/)**

---

## Voice Agents Examples

Build AI voice agents that can talk to anyone on voice or text, in any language, in any voice. The Atoms SDK provides abstractions like KnowledgeBase, Campaigns, and graph-based Workflows to let you build the smartest voice agent for your use case. Powered by the [Atoms SDK](https://atoms-docs.smallest.ai/dev).

### Basics

- [Getting Started](./voice-agents/getting_started/) — Create your first agent with `OutputAgentNode`, `generate_response()`, and `AtomsApp`
- [Agent with Tools](./voice-agents/agent_with_tools/) — Add tool calling with `@function_tool` and `ToolRegistry`
- [Call Control](./voice-agents/call_control/) — Cold/warm transfers and ending a call with `SDKAgentTransferConversationEvent`

### Multi-Node Patterns

- [Background Agent](./voice-agents/background_agent/) — `BackgroundAgentNode` for parallel processing, cross-node state sharing
- [Observability](./voice-agents/observability/) — Langfuse integration via `BackgroundAgentNode` — live traces, tool spans, transcript events
- [Language Switching](./voice-agents/language_switching/) — Multi-node agents with dynamic language detection and switching

### Call Handling

- [Inbound IVR](./voice-agents/inbound_ivr/) — Intent routing, department transfers, mute/unmute control
- [Interrupt Control](./voice-agents/interrupt_control/) — Mute/unmute events, blocking user interruptions during critical speech

### Platform Features

- [Knowledge Base RAG](./voice-agents/knowledge_base_rag/) — Attach a knowledge base with PDF upload and URL scraping for grounded responses
- [Campaigns](./voice-agents/campaigns/) — Provision bulk outbound calling with audiences and campaign management
- [Analytics](./voice-agents/analytics/) — Call logs, transcript exports, post-call metrics

### Advanced

- [Bank CSR](./voice-agents/bank_csr/) — Full banking agent — SQL queries, multi-round tool chaining, identity verification, FD management, audit logging
- [Calendar Receptionist](./voice-agents/calendar_receptionist/) — Google Calendar, webhooks, agent duplication, React client
- [Multi-Agent Voice AI Dashboard](./voice-agents/atoms_sdk_web_agent/) — Real-time dashboard with specialized agents for gaming and utility powered by Atoms SDK.

**[See all Voice Agents examples &rarr;](./voice-agents/)**

---

## Integrations

Use Smallest AI with popular frameworks and libraries.

### LangChain

Build voice AI applications using LangChain for chains, agents, memory, and prompt orchestration with Smallest AI for STT and TTS.

- [STT as LangChain Tool](./integrations/langchain/stt-as-langchain-tool/) — Wrap Pulse STT as a LangChain Tool
- [TTS as LangChain Tool](./integrations/langchain/tts-as-langchain-tool/) — Wrap Lightning TTS as a LangChain Tool
- [Voice-Optimized Prompts](./integrations/langchain/voice-optimized-prompts/) — Prompt templates tuned for spoken output
- [Conversation Memory for Voice](./integrations/langchain/conversation-memory-for-voice/) — Memory strategies for voice conversations
- [Voice AI Agent](./integrations/langchain/examples/voice-ai-agent/) — End-to-end example: audio → STT → LangChain agent → TTS → audio

**[See all LangChain integrations &rarr;](./integrations/langchain/)**

---

## Language Support

Each example includes implementations in:

- **Python** — Uses `requests`, `websockets`, and standard libraries
- **JavaScript** — Uses `node-fetch`, `ws`, and Node.js built-ins

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines. In short:

1. Create a folder with a descriptive name
2. Add implementations in `python/` and/or `javascript/` subdirectories
3. Include a `README.md` and `.env.sample`
4. If the example needs deps beyond the root `requirements.txt`, add a local `requirements.txt`
5. Update this root README with your new example

---

## Get Help

- [Discord Community](https://discord.gg/5evETqguJs)
- [Contact Support](https://smallest.ai/contact)
