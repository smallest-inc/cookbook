# Agent with Tools

Build an agent with custom function tools that the LLM can call.

## Features

- **@function_tool decorator** for defining tools
- **ToolRegistry** for auto-discovering and managing tools
- **Tool execution** in `generate_response` with parallel support
- **Intermediate feedback pattern** — speak while tools execute to avoid silence

## Demo

**Weather Query**:
```
User: What's the weather in Tokyo?
Assistant: The weather in Tokyo is Clear, 68F.
```

**Book Appointment**:
```
User: Book a haircut for tomorrow at 2pm
Assistant: Booked haircut for 2024-01-16 at 14:00. Confirmation sent!
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

- When your agent needs to take actions — check weather, book appointments, look up data
- Learning the `@function_tool` decorator, `ToolRegistry`, and intermediate feedback pattern
- For call transfers and end-call handling, [Call Control](../call_control/) is recommended

## Key Snippets

### Define Tools with Decorator

```python
from smallestai.atoms.crew.tools import function_tool

@function_tool()
def get_weather(self, city: str) -> str:
    """Get the current weather for a city.
    
    Args:
        city: The city name to check weather for.
    """
    return f"The weather in {city} is sunny, 72°F"
```

### Register Tools in Agent

```python
from smallestai.atoms.crew.tools import ToolRegistry

class AssistantAgent(OutputCrewNode):
    def __init__(self):
        super().__init__(name="assistant-agent")
        
        # Initialize tool registry
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)  # Auto-discover @function_tool methods
        self.tool_schemas = self.tool_registry.get_schemas()
```

### Execute Tools in generate_response

```python
async def generate_response(self):
    response = await self.llm.chat(
        messages=self.context.messages,
        stream=True,
        tools=self.tool_schemas
    )
    
    tool_calls = []
    async for chunk in response:
        if chunk.content:
            yield chunk.content
        if chunk.tool_calls:
            tool_calls.extend(chunk.tool_calls)
    
    if tool_calls:
        # Provide immediate feedback (best practice!)
        yield "One moment while I check that for you. "
        
        results = await self.tool_registry.execute(tool_calls, parallel=True)
        # Add results to context and get final response
```

### Intermediate Feedback Pattern

Always provide feedback during tool execution to avoid awkward silence:

```python
if tool_calls:
    yield "One moment while I check that for you. "  # User hears this immediately
    results = await self.tool_registry.execute(tool_calls)  # May take time
    # Continue with response...
```

This is essential for voice agents where silence feels unnatural.

## Tools Included

| Tool | Description |
|------|-------------|
| `get_weather` | Get current weather for a city |
| `book_appointment` | Book an appointment |
| `list_appointments` | List scheduled appointments |
| `end_call` | End the call gracefully |

## Structure

```
agent_with_tools/
├── app.py               # Server entry point
└── assistant_agent.py   # Agent with tool definitions
```

## API Reference

- [Atoms SDK — Quick Start](https://atoms-docs.smallest.ai/dev/introduction/quickstart)
- [Core Concepts — Nodes](https://atoms-docs.smallest.ai/dev/introduction/core-concepts/nodes)

## Next Steps

- [Call Control](../call_control/) — End calls, cold/warm transfers
- [Getting Started](../getting_started/) — Review basic SDK usage
