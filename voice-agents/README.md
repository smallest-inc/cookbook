# Voice Agents Cookbook

Build AI voice agents with the Atoms SDK.

## Basics

| Example | What You'll Learn |
|---------|-------------------|
| [getting_started](./getting_started/) | `OutputAgentNode`, `generate_response()`, `AtomsApp` |
| [agent_with_tools](./agent_with_tools/) | `@function_tool`, `ToolRegistry`, tool execution |
| [call_control](./call_control/) | `SDKAgentEndCallEvent`, cold/warm transfers |

## Multi-Node Patterns

| Example | What You'll Learn |
|---------|-------------------|
| [background_agent](./background_agent/) | `BackgroundAgentNode`, parallel nodes, cross-node state |
| [language_switching](./language_switching/) | `add_edge()`, custom nodes, event pipelines |

## Call Handling

| Example | What You'll Learn |
|---------|-------------------|
| [inbound_ivr](./inbound_ivr/) | Intent routing, department transfers, mute/unmute |
| [interrupt_control](./interrupt_control/) | Mute/unmute events, blocking interruptions |

## Platform Features

| Example | What You'll Learn |
|---------|-------------------|
| [knowledge_base_rag](./knowledge_base_rag/) | KB creation, PDF upload, URL scraping |
| [campaigns](./campaigns/) | Audiences, outbound campaigns |
| [analytics](./analytics/) | Call logs, transcripts, post-call metrics |

## Quick Start

```bash
pip install smallestai python-dotenv loguru
export SMALLEST_API_KEY=your_key
export OPENAI_API_KEY=your_openai_key

cd getting_started && python app.py
```

Connect:
```bash
smallestai agent chat
```

## Requirements

- Python 3.9+
- `smallestai` SDK
- OpenAI API key (for LLM)
- Smallest API key (for platform features)
