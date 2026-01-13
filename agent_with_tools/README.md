# Agent with Custom Tools

Build an agent that can call custom Python functions.

## What it does

- Check weather for any city
- Book appointments
- List scheduled appointments

## Files

- `agent.py` - Agent class with function tools
- `server.py` - WebSocket server entry point

## Run

```bash
# Terminal 1: Start server
python server.py

# Terminal 2: Connect chat
smallestai agent chat
```

## Try it

Once connected, try:
- "What's the weather in Tokyo?"
- "Book a haircut for tomorrow at 2pm"
- "What appointments do I have?"

## Key Concepts

- `@function_tool()` decorator to expose functions to LLM
- Docstrings become tool descriptions
- Function args become tool parameters
