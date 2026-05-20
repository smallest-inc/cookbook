# 🔍 Observability — Langfuse Integration

Real-time voice agent observability with [Langfuse](https://langfuse.com) via a `BackgroundCrewNode`. Every tool call, LLM generation, and transcript update streams to your Langfuse dashboard — with zero impact on conversation latency.

> **The key pattern:** a `BackgroundCrewNode` receives the same event stream as your main agent but runs silently in parallel. Swap the sink from `print()` to Langfuse (or Datadog, LangSmith, etc.) and you have production-grade observability without touching your agent code.

---

## What You'll See in Langfuse

Each call creates a **trace** with nested spans for every tool call, LLM generation, and transcript event:

![Langfuse Trace Dashboard](./langfuse-trace.png)

| Element | Langfuse Type | What It Captures |
|---------|---------------|------------------|
| Call lifecycle | **Event** | `call-started`, `call-ended` with timing |
| User/agent speech | **Event** | `transcript:user`, `transcript:assistant` with content |
| Tool executions | **Span** | Tool name, input arguments, output result, duration |
| LLM rounds | **Generation** | Model, token counts, cost, messages sent, response text |
| Call control actions | **Event** | `call-control:end-call` and other agent actions |
| Session summary | **Event** | Total turns, tool invocations, generation count |

---

## Features

| Feature | Description |
|---------|-------------|
| **Live traces** | One Langfuse trace per call, created when user joins |
| **Tool call spans** | Every tool invocation recorded with input/output and timing |
| **LLM generation logging** | Each LLM round logged with model, messages, and response |
| **Transcript events** | User and agent speech as lightweight timeline events |
| **Session summaries** | Automatic end-of-call metrics (turns, tools, generations) |
| **Zero-latency impact** | Background node runs in parallel — never blocks the agent |
| **One-file swap** | Replace `LangfuseLogger` with any sink — the agent code stays the same |

---

## Requirements

- Python ≥ 3.12
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Langfuse account](https://langfuse.com) (free tier works)
- A [Smallest AI API key](https://app.smallest.ai) (for deployment)

### Dependencies

```
smallestai >= 4.3.0
langfuse   >= 2.0.0
```

---

## Usage

### 1. Install

```bash
uv pip install -r requirements.txt
```

### 2. Set environment variables

```bash
# Agent
export OPENAI_API_KEY=sk-...
export SMALLEST_API_KEY=...

# Langfuse (from https://cloud.langfuse.com → Settings → API Keys)
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_HOST=https://cloud.langfuse.com   # or your self-hosted URL
```

Or create a `.env` file:

```env
OPENAI_API_KEY=sk-...
SMALLEST_API_KEY=...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

### 3. Run

```bash
uv run app.py
```

### 4. Test

```bash
smallestai agent-crew chat
```

### 5. Check Langfuse

Open your [Langfuse dashboard](https://cloud.langfuse.com) → **Traces** → you'll see a `voice-call` trace with all events, spans, and generations.

### 6. Deploy

```bash
smallestai agent-crew deploy --entry app.py
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          CrewSession                             │
│                                                                  │
│  ┌───────────────────────┐     ┌──────────────────────────────┐  │
│  │  LangfuseLogger        │     │  SupportAgent                │  │
│  │  BackgroundCrewNode    │     │  OutputCrewNode              │  │
│  │                         │     │                              │  │
│  │  • trace per call       │◄────│  • log_tool_call()           │  │
│  │  • transcript events    │     │  • log_generation()          │  │
│  │  • tool call spans      │     │  • log_event()               │  │
│  │  • LLM generations      │     │                              │  │
│  │  • session summary      │     │  Tools:                      │  │
│  │                         │     │  • lookup_order              │  │
│  │        ↓                │     │  • check_return_eligibility  │  │
│  │   Langfuse Cloud        │     │  • end_call                  │  │
│  └─────────────────────────┘     └──────────────────────────────┘  │
│             ▲                               ▲                    │
│             │        Events flow to         │                    │
│             └─────────── both nodes ────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

Both nodes receive the same event stream. The `LangfuseLogger` silently captures everything and streams it to Langfuse. The `SupportAgent` also explicitly pushes tool calls and LLM generations to the logger for richer detail.

---

## Files

| File | Lines | Description |
|------|-------|-------------|
| `app.py` | ~60 | Entry point — wires `LangfuseLogger` + `SupportAgent`, handles greeting, flushes at end |
| `langfuse_logger.py` | ~220 | `BackgroundCrewNode` → Langfuse traces, spans, generations, events |
| `support_agent.py` | ~193 | Simple `OutputCrewNode` with order tools, pushes data to logger |
| `requirements.txt` | ~3 | Dependencies |

---

## How It Works

### 1. Session Setup (`app.py`)

Two nodes run in parallel:

```python
langfuse = LangfuseLogger()      # BackgroundCrewNode — streams to Langfuse
session.add_node(langfuse)

agent = SupportAgent(langfuse=langfuse)  # OutputCrewNode — conversation
session.add_node(agent)

# Register event handlers BEFORE starting the session
@session.on_event("on_event_received")
async def on_event_received(_, event):
    ...

await session.start()
```

At session end, flush to ensure all events are sent:

```python
langfuse.flush()
```

### 2. Automatic Event Capture (`langfuse_logger.py`)

The background node creates a Langfuse trace on user-joined and logs transcripts automatically:

```python
class LangfuseLogger(BackgroundCrewNode):
    async def process_event(self, event: SDKEvent):
        if isinstance(event, SDKSystemUserJoinedEvent):
            # Root span — Langfuse auto-creates the trace
            self._root_span = self._langfuse.start_span(name="voice-call")

        elif isinstance(event, SDKAgentTranscriptUpdateEvent):
            self._root_span.create_event(
                name=f"transcript:{event.role}",
                metadata={"role": event.role, "content": event.content},
            )
```

### 3. Explicit Tool & LLM Logging (`support_agent.py`)

The main agent pushes detailed tool call and LLM data to the logger:

```python
# After executing tools:
self.langfuse.log_tool_call(
    tool_name=tc.name,
    args=tc.arguments,
    result=str(result.content),
)

# After each LLM round:
self.langfuse.log_generation(
    model="gpt-4o-mini",
    messages=self.context.messages,
    output=full_response,
    tool_calls=[{"name": tc.name, "arguments": tc.arguments} for tc in tool_calls],
)
```

### 4. Langfuse API Mapping (SDK 3.x)

| Agent Event | Langfuse Method | Why |
|-------------|-----------------|-----|
| User joins | `langfuse.start_span()` | Creates root span (trace is implicit) |
| Transcript update | `root_span.create_event()` | Lightweight marker — no duration |
| Tool call | `root_span.start_span()` + `.end()` | Has input/output/duration — shows in the waterfall |
| LLM round | `root_span.start_observation(as_type="generation")` | Captures model, messages, response — tracks token usage |
| Call end | `root_span.create_event()` + `langfuse.flush()` | Final summary + ensure delivery |

---

## Adapting to Other Platforms

The `LangfuseLogger` is a thin adapter. To switch to another platform, create a new `BackgroundCrewNode` with the same interface:

### Datadog

```python
from datadog import statsd

class DatadogLogger(BackgroundCrewNode):
    def log_tool_call(self, tool_name, args, result):
        statsd.increment("voice_agent.tool_call", tags=[f"tool:{tool_name}"])

    def log_generation(self, model, messages, output, tool_calls=None):
        statsd.increment("voice_agent.llm_generation", tags=[f"model:{model}"])
```

### LangSmith

```python
from langsmith import Client

class LangSmithLogger(BackgroundCrewNode):
    def __init__(self):
        super().__init__(name="langsmith-logger")
        self.client = Client()
        self.run = None

    async def process_event(self, event):
        if isinstance(event, SDKSystemUserJoinedEvent):
            self.run = self.client.create_run(name="voice-call", run_type="chain")
```

### Custom Webhook

```python
import httpx

class WebhookLogger(BackgroundCrewNode):
    def __init__(self, webhook_url: str):
        super().__init__(name="webhook-logger")
        self.url = webhook_url
        self.client = httpx.AsyncClient()

    def log_tool_call(self, tool_name, args, result):
        self.client.post(self.url, json={"type": "tool_call", "tool": tool_name, ...})
```

The main agent code (`SupportAgent`) stays **completely unchanged** — just swap which logger you pass in `app.py`.

---

## Example Interaction

```
You:    What's the status of order ORD-1234?
Agent:  [lookup_order("ORD-1234")]
        Your order ORD-1234 has shipped and should arrive by February 12th.

You:    Can I return it?
Agent:  [check_return_eligibility("ORD-1234")]
        That order isn't eligible for return yet since it hasn't been delivered.

You:    Thanks, bye!
Agent:  [end_call]
        Goodbye! Have a great day.
```

Meanwhile, in your Langfuse dashboard — every tool call, LLM round, and transcript turn is visible in real-time.

---

## When to Use This

✅ **Use this example when you need to:**
- Add production observability to any voice agent
- Debug tool call chains in real-time
- Monitor LLM token usage and latency per call
- Build a live transcript viewer
- Track agent performance metrics across calls
- Audit tool usage for compliance

❌ **This is NOT the right example if you:**
- Just need basic logging → use `loguru` / `print` in your agent
- Need sentiment analysis → see [`background_agent`](../background_agent)
- Need a full banking agent → see [`bank_csr`](../bank_csr)
- Need call transfers → see [`call_control`](../call_control)

---

## API Reference

| Component | Import | Purpose |
|-----------|--------|---------|
| `AtomsCrewApp` | `smallestai.atoms.crew.server` | WebSocket server + session lifecycle |
| `CrewSession` | `smallestai.atoms.crew.session` | Session management, node graph |
| `OutputCrewNode` | `smallestai.atoms.crew.nodes` | Conversational agent with TTS output |
| `BackgroundCrewNode` | `smallestai.atoms.crew.nodes` | Silent parallel processing node |
| `OpenAIClient` | `smallestai.atoms.crew.clients.openai` | Streaming LLM client |
| `ToolRegistry` | `smallestai.atoms.crew.tools` | Tool discovery, schema generation, execution |
| `@function_tool` | `smallestai.atoms.crew.tools` | Decorator to register tools from methods |
| `SDKAgentEndCallEvent` | `smallestai.atoms.crew.events` | End call |
| `Langfuse` | `langfuse` | Langfuse Python SDK client |

- Atoms SDK docs: [docs.smallest.ai](https://docs.smallest.ai)
- Langfuse docs: [langfuse.com/docs](https://langfuse.com/docs)

---

## Next Steps

- **Complex agent with audit logging** → [`bank_csr`](../bank_csr) — the same `BackgroundCrewNode` pattern with SQLite-backed compliance logging
- **Sentiment analysis node** → [`background_agent`](../background_agent) — another `BackgroundCrewNode` use case
- **Call transfers** → [`call_control`](../call_control) — cold and warm transfers
- **Add cost tracking** → Use Langfuse's token usage fields in `log_generation` to track per-call LLM costs
- **Build dashboards** → Use Langfuse's analytics to track tool usage patterns, average call duration, and escalation rates
- **Self-hosted Langfuse** → Set `LANGFUSE_HOST` to your own instance for full data control
