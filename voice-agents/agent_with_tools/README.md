# Agent with Tools

Build an agent with custom function tools that the LLM can call.

## Overview

This example demonstrates:
- **@function_tool decorator** for defining tools
- **ToolRegistry** for managing tools
- **Tool execution** in generate_response

## Files

- `app.py` - Server entry point
- `assistant_agent.py` - Agent with tool definitions
- `pyproject.toml` - Project dependencies

## Tools Included

| Tool | Description |
|------|-------------|
| `get_weather` | Get current weather for a city |
| `book_appointment` | Book an appointment |
| `list_appointments` | List scheduled appointments |
| `end_call` | End the call gracefully |

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

## Example Interactions

**Weather Query**:
```
User: What's the weather in Tokyo?
Assistant: The weather in Tokyo is Clear, 68°F.
```

**Book Appointment**:
```
User: Book a haircut for tomorrow at 2pm
Assistant: Booked haircut for 2024-01-16 at 14:00. Confirmation sent!
```

## Key Code

### Define Tools with Decorator

```python
from smallestai.atoms.agent.tools import function_tool

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
from smallestai.atoms.agent.tools import ToolRegistry

class AssistantAgent(OutputAgentNode):
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

## Next Steps

- See [Call Control](../call_control) for ending calls and transfers
- See [Getting Started](../getting_started) for basic SDK usage
