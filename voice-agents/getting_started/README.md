# Getting Started

Your first Atoms agent — from zero to a running AI assistant.

## Features

- **OutputCrewNode** — The base class for conversational agents
- **generate_response()** — Streaming LLM responses
- **AtomsCrewApp** — Running the agent server
- **Event handling** — Greeting users on join

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

## Usage

```bash
uv pip install -r requirements.txt
uv run server.py
```

Connect with the CLI:

```bash
smallestai agent-crew chat
```

## Recommended Usage

- Your starting point — the simplest possible Atoms agent with LLM responses
- Learning the core concepts: `OutputCrewNode`, `generate_response()`, `AtomsCrewApp`
- For function calling, [Agent with Tools](../agent_with_tools/) is recommended

## Key Snippets

### Define an Agent

```python
from smallestai.atoms.crew.nodes import OutputCrewNode
from smallestai.atoms.crew.clients.openai import OpenAIClient

class Assistant(OutputCrewNode):
    def __init__(self):
        super().__init__(name="assistant")
        self.llm = OpenAIClient(model="gpt-4o-mini")

    async def generate_response(self):
        response = await self.llm.chat(
            messages=self.context.messages,
            stream=True
        )
        async for chunk in response:
            if chunk.content:
                yield chunk.content
```

### Run the Server

```python
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession

async def setup_session(session: CrewSession):
    agent = Assistant()
    session.add_node(agent)
    await session.start()
    await session.wait_until_complete()

if __name__ == "__main__":
    app = AtomsCrewApp(setup_handler=setup_session)
    app.run()
```

## Structure

```
getting_started/
├── server.py    # Server entry point
└── assistant.py  # Simple conversational agent
```

## Example Output

```
Assistant: Hello! I'm your AI assistant. How can I help you today?
You: What's the capital of France?
Assistant: The capital of France is Paris.
```

## API Reference

- [Atoms SDK — Quick Start](https://docs.smallest.ai/atoms/developer-guide/get-started/quickstart)
- [Core Concepts — Nodes](https://docs.smallest.ai/atoms/developer-guide/get-started/agent-crew-core-concepts/nodes)

## Next Steps

- [Agent with Tools](../agent_with_tools/) — Add custom function tools the LLM can call
- [Call Control](../call_control/) — End calls and transfer to humans
