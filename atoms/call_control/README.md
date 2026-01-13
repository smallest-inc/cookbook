# Call Control Example

Agent that can end calls and transfer to humans.

## Features

- End calls gracefully (when user says goodbye)
- Transfer to human agent (when user requests)
- Order lookup tool

## Files

- `agent.py` - SupportAgent class with call control
- `server.py` - WebSocket server entry point

## Configure

Create `.env`:
```
TRANSFER_NUMBER=+1234567890
```

## Run

```bash
# Terminal 1: Start server
python server.py

# Terminal 2: Connect chat
smallestai agent chat
```

## Try it

Test call control:
- "Thanks, goodbye" → Agent ends call
- "I want to speak to a human" → Agent transfers

## Key Concepts

- `SDKAgentEndCallEvent` - End the call
- `SDKAgentTransferConversationEvent` - Transfer call
- `TransferOption` - Cold or warm transfer
- `on_hold_music` - Hold music selection
