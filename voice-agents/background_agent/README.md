# Background Agent

Multi-node architecture with real-time sentiment analysis running alongside the main agent.

## Features

- **BackgroundCrewNode** — Processes events without producing audio output
- **Multi-node sessions** — Multiple agents running in parallel
- **Event handling** — Reacting to `UserStartedSpeaking`, `UserStoppedSpeaking`, `TranscriptUpdate`
- **Cross-agent communication** — Main agent queries background agent state
- **Auto-escalation** — Transfer based on detected frustration

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CrewSession                        │
│                                                         │
│  ┌─────────────────────┐   ┌─────────────────────────┐  │
│  │  SentimentAnalyzer  │   │     SupportAgent        │  │
│  │  (BackgroundNode)   │   │    (OutputCrewNode)    │  │
│  │                     │   │                         │  │
│  │  - Listens to all   │   │  - Handles conversation │  │
│  │    events           │◄──│  - Queries sentiment    │  │
│  │  - Analyzes text    │   │  - Auto-escalates       │  │
│  │  - Stores state     │   │                         │  │
│  └─────────────────────┘   └─────────────────────────┘  │
│            ▲                          ▲                 │
│            │      Events flow to      │                 │
│            └──────── both nodes ──────┘                 │
└─────────────────────────────────────────────────────────┘
```

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

Both `SupportAgent` and `SentimentAnalyzer` call the OpenAI Chat Completions API for response generation and sentiment classification respectively, so you'll need an `OPENAI_API_KEY`.

## Usage

### 1. Configure environment

```bash
cp .env.sample .env
# Open .env and add your OPENAI_API_KEY
```

### 2. Install dependencies

```bash
uv pip install -r requirements.txt
```

### 3. Run the agent locally

```bash
uv run app.py
```

Starts a WebSocket server on `localhost:8080`.

### 4. Test via CLI

```bash
smallestai agent-crew chat
```

Try the conversation in [Example Output](#example-output) below — three frustrated messages will trigger the auto-escalation branch in `SupportAgent.generate_response()`.

### 5. Deploy to Smallest Platform

```bash
smallestai agent-crew deploy --entry app.py
```

Then activate the build so it serves real calls:

```bash
smallestai agent-crew builds
# pick your build from the table → choose "Make Live"
```

Then make a call from the [Smallest Platform](https://app.smallest.ai) dashboard.

> **Note — environment variables on deployed builds:** the deploy pipeline does not yet propagate `.env` / `OPENAI_API_KEY` into the running pod, so this example currently works end-to-end **only locally**. Once `smallestai agent-crew deploy` learns to ship a Kubernetes Secret with your env vars, deployed builds will be able to make OpenAI calls too. Until then, on a real call you'll see `openai.OpenAIError: Missing credentials` in the pod logs and the connection will close. Replace the OpenAI client with a stub (or use an LLM the pod can reach without credentials) if you want to test the deployed flow.

## Recommended Usage

- Background processing alongside your main agent — sentiment analysis, compliance monitoring, real-time analytics
- Multi-node sessions where agents run in parallel and share state
- For sequential pipeline processing, [Language Switching](../language_switching/) is recommended

## Key Snippets

### BackgroundCrewNode

Unlike `OutputCrewNode`, background agents:
- Don't produce audio output
- Don't auto-handle interrupts
- Process events silently in the background
- Store state for other agents to query

```python
from smallestai.atoms.crew.nodes import BackgroundCrewNode

class SentimentAnalyzer(BackgroundCrewNode):
    def __init__(self):
        super().__init__(name="sentiment-analyzer")
        self.current_sentiment = "neutral"

    async def process_event(self, event: SDKEvent):
        if isinstance(event, SDKAgentTranscriptUpdateEvent):
            if event.role == "user":
                self.current_sentiment = await self._analyze(event.content)
```

### Multi-Node Session

Add multiple nodes to run them in parallel:

```python
async def setup_session(session: CrewSession):
    background_agent = SentimentAnalyzer()
    main_agent = SupportAgent(sentiment_analyzer=background_agent)
    
    # Both nodes receive all events
    session.add_node(background_agent)
    session.add_node(main_agent)
    
    await session.start()
```

### Speaking Events

React to user speaking state:

```python
async def process_event(self, event: SDKEvent):
    if isinstance(event, SDKSystemUserStartedSpeakingEvent):
        # User started talking
        pass
    elif isinstance(event, SDKSystemUserStoppedSpeakingEvent):
        # User finished talking
        pass
```

## Example Output

```
Assistant: Hello! I'm here to help. What can I assist you with today?
User: I've been waiting for my order for 3 weeks and nobody will help me!
[SentimentAnalyzer] Detected frustrated sentiment (frustration count: 1)
Assistant: I completely understand your frustration, and I'm sorry for the delay...

User: This is ridiculous! I want a refund now!
[SentimentAnalyzer] Detected frustrated sentiment (frustration count: 2)
Assistant: I hear you, and I want to make this right...

User: I can't believe how terrible this service is!
[SentimentAnalyzer] Detected frustrated sentiment (frustration count: 3)
[Auto-escalation triggered]
Assistant: I can hear this has been frustrating. Let me connect you with a supervisor...
```

## Use Cases

- **Escalation triggers** — Auto-transfer when frustration is high
- **Call quality monitoring** — Track sentiment across calls
- **Agent coaching** — Real-time feedback for human agents
- **Analytics** — Post-call sentiment reports

## Structure

```
background_agent/
├── app.py                  # Session setup with multi-node architecture
├── sentiment_analyzer.py   # BackgroundCrewNode for sentiment analysis
└── support_agent.py        # OutputCrewNode with sentiment-aware responses
```

## API Reference

- [Agents — Overview](https://docs.smallest.ai/atoms/developer-guide/build/agent-crews/overview)
- [Core Concepts — Nodes](https://docs.smallest.ai/atoms/developer-guide/get-started/agent-crew-core-concepts/nodes)

## Next Steps

- [Language Switching](../language_switching/) — Chained node pipelines with `add_edge()`
- [Interrupt Control](../interrupt_control/) — Mute/unmute control
