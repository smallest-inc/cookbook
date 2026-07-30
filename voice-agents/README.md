# Voice Agents Cookbook

Build AI voice agents with the [Atoms SDK](https://docs.smallest.ai/atoms/developer-guide) or [Pipecat](https://github.com/pipecat-ai/pipecat).

## Pipecat

| Example | What You'll Learn |
|---------|-------------------|
| [pipecat-voice-agent](./pipecat-voice-agent/) | Smallest AI STT + TTS in a browser voice agent using SmallWebRTC |
| [livekit-voice-agent](./livekit-voice-agent/) | Smallest AI STT + TTS with LiveKit transport |
| [gradient-bang-smallest](./gradient-bang-smallest/) | Swap existing STT + TTS providers for Smallest AI in the Gradient Bang multiplayer game; run locally with Docker + Supabase |

## Basics

| Example | What You'll Learn |
|---------|-------------------|
| [getting_started](./getting_started/) | `OutputCrewNode`, `generate_response()`, `AtomsCrewApp` |
| [agent_with_tools](./agent_with_tools/) | `@function_tool`, `ToolRegistry`, tool execution |
| [call_control](./call_control/) | `SDKAgentEndCallEvent`, cold/warm transfers |

## Multi-Node Patterns

| Example | What You'll Learn |
|---------|-------------------|
| [background_agent](./background_agent/) | `BackgroundCrewNode`, parallel nodes, cross-node state |
| [observability](./observability/) | Langfuse integration via `BackgroundCrewNode` — live traces, tool spans, transcript events |
| [language_switching](./language_switching/) | `add_edge()`, custom nodes, event pipelines |

## Call Handling

| Example | What You'll Learn |
|---------|-------------------|
| [inbound_ivr](./inbound_ivr/) | Intent routing, department transfers, mute/unmute |
| [interrupt_control](./interrupt_control/) | Mute/unmute events, blocking interruptions |

## Advanced

| Example | What You'll Learn |
|---------|-------------------|
| [bank_csr](./bank_csr/) | Multi-round tool chaining, real SQLite DB, deterministic computation, audit logging, banking actions |
| [appointment_scheduler](./appointment_scheduler/) | Cal.com integration, slot negotiation ("5pm is busy, how about 7:30?"), live booking |
| [calendar_receptionist](./calendar_receptionist/) | Google Calendar integration, webhook workflow, agent duplication, React client |
| [form_filler](./form_filler/) | State machine data collection, Jotform integration, typed validation, backtracking |
| [atoms_sdk_web_agent](./atoms_sdk_web_agent/) | Multi-agent collaboration, tool calling, Next.js integration |

## Platform Features

| Example | What You'll Learn |
|---------|-------------------|
| [knowledge_base_rag](./knowledge_base_rag/) | KB creation, PDF upload, URL scraping |
| [campaigns](./campaigns/) | Audiences, outbound campaigns |
| [analytics](./analytics/) | Call logs, transcripts, post-call metrics |

## Quick Start

### Step 1: Create env + install base deps (once, from repo root)

```bash
uv venv
uv pip install -r requirements.txt
```

### Step 2: Run an example

```bash
uv pip install -r voice-agents/getting_started/requirements.txt
uv run voice-agents/getting_started/app.py
```

For another example:

```bash
uv pip install -r voice-agents/bank_csr/requirements.txt
uv run voice-agents/bank_csr/app.py
```

### Step 3: Connect via CLI

```bash
smallestai agent-crew chat
```

### API Keys

```bash
export SMALLEST_API_KEY=your_key
export OPENAI_API_KEY=your_openai_key
```

## Requirements

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Python 3.10+
- `smallestai` SDK (`>=5.3.1`)
- OpenAI API key (for LLM)
- Smallest API key (for platform features)
