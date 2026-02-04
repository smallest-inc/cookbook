# Inbound IVR

IVR-style agent with intent routing, department transfers, and mute/unmute control.

## Overview

This example demonstrates:
- **Intent Detection** - Understanding caller needs
- **Department Routing** - Transfers to appropriate teams
- **Cold vs Warm Transfer** - Simple routing vs briefed handoff
- **Mute/Unmute** - Controlling caller's microphone
- **IVR Design Patterns** - Quick, professional call handling

## Files

- `app.py` - Server entry point with greeting
- `ivr_agent.py` - IVR agent with routing logic

## Key Concepts

### Department Configuration

Define your departments with phone numbers and metadata:

```python
DEPARTMENTS = {
    "sales": {
        "number": "+1111111111",
        "description": "New orders, pricing, product information",
        "hours": "9 AM - 6 PM EST"
    },
    "support": {
        "number": "+2222222222",
        "description": "Technical issues, troubleshooting",
        "hours": "24/7"
    }
}
```

### Cold Transfer (Quick Routing)

Direct handoff without briefing the receiving agent:

```python
@function_tool()
async def transfer_to_department(self, department: str, reason: str):
    await self.send_event(
        SDKAgentTransferConversationEvent(
            transfer_call_number=DEPARTMENTS[department]["number"],
            transfer_options=TransferOption(
                type=TransferOptionType.COLD_TRANSFER
            ),
            on_hold_music="relaxing_sound"
        )
    )
```

### Warm Transfer (Briefed Handoff)

Brief the receiving agent before connecting:

```python
transfer_options = TransferOption(
    type=TransferOptionType.WARM_TRANSFER,
    private_handoff_option=WarmTransferPrivateHandoffOption(
        type=WarmTransferHandoffOptionType.PROMPT,
        prompt=f"Incoming call for {department}. Reason: {reason}"
    )
)
```

### Mute/Unmute User

Control the caller's microphone:

```python
from smallestai.atoms.agent.events import (
    SDKAgentControlMuteUserEvent,
    SDKAgentControlUnmuteUserEvent,
)

@function_tool()
async def mute_caller(self):
    """Mute during holds or private consultations."""
    await self.send_event(SDKAgentControlMuteUserEvent())

@function_tool()
async def unmute_caller(self):
    """Resume normal conversation."""
    await self.send_event(SDKAgentControlUnmuteUserEvent())
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

3. Configure department phone numbers in `ivr_agent.py`

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

### Simple Routing
```
Agent: Thank you for calling TechCorp. I can help you reach Sales, Support, 
       Billing, or Returns. How may I direct your call?
User: I need to talk to someone about my bill.
Agent: I'll connect you to our Billing department. Is that correct?
User: Yes, please.
Agent: Transferring you now. Please hold.
[Cold transfer to Billing]
```

### Complex Issue (Warm Transfer)
```
Agent: How may I direct your call?
User: I've been having issues with my account for weeks and nobody can help.
Agent: I understand this has been frustrating. Let me connect you with a senior 
       support specialist who can resolve this. I'll brief them on your situation 
       first. Please hold.
[Warm transfer with context: "Recurring account issue, customer frustrated"]
```

### Intent Clarification
```
Agent: How may I direct your call?
User: I need help with something.
Agent: I'd be happy to help. Could you tell me more about what you need?
       Are you looking to make a purchase, get technical support, 
       discuss billing, or process a return?
User: My product isn't working right.
Agent: I'll connect you with our Technical Support team. They're available 24/7.
```

## Hold Music Options

Available hold music styles:
- `"ringtone"` - Standard phone ringing
- `"relaxing_sound"` - Calm ambient music
- `"uplifting_beats"` - Energetic hold music
- `"none"` - Silence

## Best Practices

1. **Be Concise** - IVR interactions should be quick
2. **Confirm Before Transfer** - Always verify the department
3. **Use Warm Transfer for Complex Issues** - Provide context
4. **Offer Alternatives** - If a department is closed
5. **Track Intents** - Log routing for analytics

## Next Steps

- See [Call Control](../call_control) for more transfer patterns
- See [Background Agent](../background_agent) for sentiment-based routing
