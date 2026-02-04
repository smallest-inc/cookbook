# Language Switching

Multi-language support agent with automatic language detection and response.

## Overview

This example demonstrates:
- **Node Chaining** - Using `add_edge()` to create processing pipelines
- **Custom Node Types** - Extending the base `Node` class
- **Event Transformation** - Modifying events as they flow through the pipeline
- **Cross-Node Communication** - Nodes querying each other's state

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

## Files

- `app.py` - Pipeline setup with edges
- `language_detector.py` - Custom Node for language detection
- `support_agent.py` - OutputAgentNode with language awareness
- `profanity_filter.py` - Custom Node for response filtering

## Key Concepts

### Creating Custom Nodes

Extend the base `Node` class for custom processing:

```python
from smallestai.atoms.agent.nodes.base import Node

class MyProcessor(Node):
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
async def setup_session(session: AgentSession):
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

### Cross-Node Communication

Nodes can reference each other for state queries:

```python
class SupportAgent(OutputAgentNode):
    def __init__(self, language_detector: LanguageDetector):
        self.language_detector = language_detector
    
    @function_tool()
    def get_language(self):
        return self.language_detector.detected_language
```

## Setup

1. Install dependencies:
```bash
pip install smallestai python-dotenv loguru
```

2. Create `.env` file:
```bash
OPENAI_API_KEY=your_openai_key
```

## Running the Example

Start the server:
```bash
python app.py
```

Connect with the CLI:
```bash
smallestai agent chat
```

## Example Interaction

```
[LanguageDetector] Started
[SupportAgent] Started  
[ProfanityFilter] Started

Agent: Hello! Welcome to our support line. I can help you in multiple languages.

User: Hola, necesito ayuda con mi cuenta.
[LanguageDetector] Detected: spanish (confidence: 95%)

Agent: ¡Hola! Con gusto le ayudo con su cuenta. ¿Cuál es el problema?

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

## Next Steps

- See [Background Agent](../background_agent) for parallel processing
- See [Interrupt Control](../interrupt_control) for mute/unmute control