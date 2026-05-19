# Interrupt Control

Control user interruptions at runtime using mute/unmute events.

## Features

- **SDKAgentControlMuteUserEvent** — Mutes user's microphone (platform-level)
- **SDKAgentControlUnmuteUserEvent** — Unmutes user's microphone
- **Auto-unmute** after each response to avoid leaving the user stuck
- **Tool-based toggle** — LLM decides when to mute/unmute based on context

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

**Try these:**
- "Speak 7 words and I'll try to interrupt you"
- "Disable interruptions and tell me a fact"
- "Read me an important message"

## Recommended Usage

| Use Case | Example |
|----------|---------|
| Legal disclaimers | "By continuing, you agree to our terms..." |
| Safety instructions | "Please do not operate machinery while..." |
| Important announcements | "Your account will be charged $50..." |
| Reading long content | Terms and conditions, policies |
| Critical information | Security codes, confirmation numbers |

Use sparingly — for normal conversational agents where users expect to interrupt, this is not needed.

## Key Snippets

```
User: "Read me 7 words without interruption"
     ↓
Agent calls set_interruptible(False)
     ↓
Platform mutes user's mic
     ↓
Agent speaks: "Here are exactly seven words for you"
     ↓
Response completes → Auto-unmute
     ↓
User can speak again
```

### Impact

| When Muted | When Unmuted (default) |
|------------|------------------------|
| User's mic is silenced | Normal conversation |
| User cannot interrupt | User can interrupt anytime |
| Agent speaks uninterrupted | Natural back-and-forth |
| Auto-unmutes after response | — |

### Key Code

```python
from smallestai.atoms.crew.events import (
    SDKAgentControlMuteUserEvent,
    SDKAgentControlUnmuteUserEvent,
)

@function_tool()
async def set_interruptible(self, enabled: bool) -> str:
    if enabled:
        await self.send_event(SDKAgentControlUnmuteUserEvent())
        self.user_muted = False
        return "User unmuted."
    else:
        await self.send_event(SDKAgentControlMuteUserEvent())
        self.user_muted = True
        return "User muted. Speak now."
```

### Auto-Unmute Pattern

Always unmute after the response to avoid leaving user stuck:

```python
async def generate_response(self):
    # ... generate response ...
    
    # Auto-unmute at end
    if self.user_muted:
        await self.send_event(SDKAgentControlUnmuteUserEvent())
        self.user_muted = False
```

## Best Practices

1. **Keep muted sections short** — Don't mute for long monologues
2. **Always auto-unmute** — Never leave user permanently muted
3. **Don't announce muting** — Just mute and speak the content
4. **Use sparingly** — Only for truly important content
5. **Test on platform** — Mute/unmute are platform-level events

## Limitations

- Mute/unmute only works on deployed agents (not local CLI)
- User is fully silenced — no partial muting
- Mute persists until explicitly unmuted or response ends

## Structure

```
interrupt_control/
├── app.py                 # Server entry point
└── configurable_agent.py  # Agent with mute/unmute tools
```

## API Reference

- [Core Concepts — Events](https://atoms-docs.smallest.ai/dev/introduction/core-concepts/events)
- [Core Concepts — Nodes](https://atoms-docs.smallest.ai/dev/introduction/core-concepts/nodes)

## Next Steps

- [Background Agent](../background_agent/) — Sentiment detection
- [Inbound IVR](../inbound_ivr/) — Call routing
