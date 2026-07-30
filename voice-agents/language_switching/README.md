# Language Switching

Multi-language support agent with automatic language detection and response.

## Features

- **CrewNode Chaining** — Using `add_edge()` to create processing pipelines
- **Custom CrewNode Types** — Extending the base `CrewNode` class
- **Event Transformation** — Modifying events as they flow through the pipeline
- **Cross-CrewNode Communication** — Nodes querying each other's state
- **Language Detection** — Automatic language identification with confidence scoring
- **Profanity Filtering** — Post-processing pipeline for response sanitization

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Event Flow                                     │
│                                                                         │
│  ┌──────┐   ┌──────────────────┐   ┌──────────────┐   ┌───────────────┐ │
│  │ Root │──►│ LanguageDetector │──►│ SupportAgent │──►│ProfanityFilter│ │
│  └──────┘   └──────────────────┘   └──────────────┘   └───────────────┘ │
│      │              │                     │                    │        │
│      ▼              ▼                     ▼                    ▼        │
│   WebSocket      Detects              Generates           Sanitizes     │
│    Events        Language             Response            Response      │
│                                                                ▼        │
│                                                           ┌──────┐      │
│                                                           │ Sink │──►TTS│
│                                                           └──────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

## Usage

```bash
uv pip install -r requirements.txt
uv run app.py
```

Connect with the CLI:

```bash
smallestai agent-crew chat
```

## Recommended Usage

- Sequential event processing pipelines — language detection, content filtering, event transformation
- Pre/post-processing of events with custom `CrewNode` classes and `add_edge()`
- For parallel background processing, [Background Agent](../background_agent/) is recommended

## Key Snippets

### Creating Custom Nodes

Extend the base `CrewNode` class for custom processing:

```python
from smallestai.atoms.crew.nodes.base import CrewNode

class MyProcessor(CrewNode):
    def __init__(self):
        super().__init__(name="my-processor")

    async def process_event(self, event: SDKEvent):
        # Do something with the event
        processed = self.transform(event)
        
        # IMPORTANT: Forward to children
        await self.send_event(processed)
```

### Building Pipelines with Edges

Use `add_edge()` to chain nodes:

```python
async def setup_session(session: CrewSession):
    node_a = NodeA()
    node_b = NodeB()
    node_c = NodeC()
    
    session.add_node(node_a)
    session.add_node(node_b)
    session.add_node(node_c)
    
    # Create pipeline: A -> B -> C
    session.add_edge(node_a, node_b)
    session.add_edge(node_b, node_c)
    
    await session.start()
```

### Automatic Root/Sink Connection

- Nodes **without incoming edges** connect to Root automatically
- Nodes **without outgoing edges** connect to Sink automatically

```python
# This creates: Root -> A -> B -> C -> Sink
session.add_node(a)
session.add_node(b)
session.add_node(c)
session.add_edge(a, b)
session.add_edge(b, c)
```

### Cross-CrewNode Communication

Nodes can reference each other for state queries:

```python
class SupportAgent(OutputCrewNode):
    def __init__(self, language_detector: LanguageDetector):
        self.language_detector = language_detector
    
    @function_tool()
    def get_language(self):
        return self.language_detector.detected_language
```

## Example Output

```
[LanguageDetector] Started
[SupportAgent] Started  
[ProfanityFilter] Started

Agent: Hello! Welcome to our support line. I can help you in multiple languages.

User: Hola, necesito ayuda con mi cuenta.
[LanguageDetector] Detected: spanish (confidence: 95%)

Agent: Hola! Con gusto le ayudo con su cuenta. Cual es el problema?

User: No puedo iniciar sesión.

Agent: Entiendo. Déjeme verificar su cuenta...
```

## Pipeline Patterns

### Pre-Processing (before agent)
- Language detection
- Intent classification
- Input validation
- Context enrichment

### Post-Processing (after agent)
- Profanity filtering
- Response formatting
- Compliance checks
- Logging/analytics

### Parallel Processing
For parallel nodes (no edges between them), use the pattern from `background_agent`:
```python
session.add_node(node_a)
session.add_node(node_b)  # Both receive same events
```

## Structure

```
language_switching/
├── app.py                # Pipeline setup with edges
├── language_detector.py  # Custom CrewNode for language detection
├── support_agent.py      # OutputCrewNode with language awareness
└── profanity_filter.py   # Custom CrewNode for response filtering
```

## API Reference

- [Core Concepts — Graphs](https://docs.smallest.ai/voice-agents/developer-guide/get-started/agent-crew-core-concepts/graphs)
- [Core Concepts — Nodes](https://docs.smallest.ai/voice-agents/developer-guide/get-started/agent-crew-core-concepts/nodes)

## Next Steps

- [Background Agent](../background_agent/) — Parallel processing
- [Interrupt Control](../interrupt_control/) — Mute/unmute control
