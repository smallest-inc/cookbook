# Getting Started

Your first Atoms agent — from zero to a running AI assistant.

## Features

- **OutputSwarmNode** — The base class for conversational agents
- **generate_response()** — Streaming LLM responses
- **AtomsSwarmApp** — Running the agent server
- **Event handling** — Greeting users on join

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

## Usage

```bash
uv pip install -r requirements.txt
uv run app.py
```

Connect with the CLI:

```bash
smallestai agent-swarm chat
```

## Recommended Usage

- Your starting point — the simplest possible Atoms agent with LLM responses
- Learning the core concepts: `OutputSwarmNode`, `generate_response()`, `AtomsSwarmApp`
- For function calling, [Agent with Tools](../agent_with_tools/) is recommended

## Key Snippets

### Define an Agent

```python
from smallestai.atoms.swarm.nodes import OutputSwarmNode
from smallestai.atoms.swarm.clients.openai import OpenAIClient

class MyAgent(OutputSwarmNode):
    def __init__(self):
        super().__init__(name="my-agent")
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
from smallestai.atoms.swarm.server import AtomsSwarmApp
from smallestai.atoms.swarm.session import SwarmSession

async def setup_session(session: SwarmSession):
    agent = MyAgent()
    session.add_node(agent)
    await session.start()
    await session.wait_until_complete()

if __name__ == "__main__":
    app = AtomsSwarmApp(setup_handler=setup_session)
    app.run()
```

## Structure

```
getting_started/
├── app.py       # Server entry point
└── my_agent.py  # Simple conversational agent
```

## Example Output

```
Assistant: Hello! I'm your AI assistant. How can I help you today?
You: What's the capital of France?
Assistant: The capital of France is Paris.
```

## API Reference

- [Atoms SDK — Quick Start](https://atoms-docs.smallest.ai/dev/introduction/quickstart)
- [Core Concepts — Nodes](https://atoms-docs.smallest.ai/dev/introduction/core-concepts/nodes)

## Next Steps

- [Agent with Tools](../agent_with_tools/) — Add custom function tools the LLM can call
- [Call Control](../call_control/) — End calls and transfer to humans
