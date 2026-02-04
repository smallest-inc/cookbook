# Campaign Management

Scripts for managing outbound calling campaigns.

## Overview

This cookbook demonstrates:
- **Audience Creation** - Build contact lists for campaigns
- **Campaign Setup** - Link agents, audiences, and phone numbers
- **Campaign Control** - Start, stop, pause, and monitor
- **Contact Management** - Add contacts to existing audiences

## Workflow

```
1. Create Agent (via dashboard or API)
        ↓
2. Create Audience (contact list)
        ↓
3. Create Campaign (link agent + audience + phone)
        ↓
4. Start Campaign
        ↓
5. Monitor Status
        ↓
6. Stop/Pause as needed
```

## Files

| Script | Description |
|--------|-------------|
| `create_audience.py` | Create a new audience with contacts |
| `add_contacts.py` | Add contacts to existing audience |
| `create_campaign.py` | Create a campaign |
| `manage_campaign.py` | Start/stop/pause/status commands |

## Setup

1. Install dependencies:
```bash
pip install smallestai python-dotenv
```

2. Create `.env` file:
```bash
SMALLEST_API_KEY=your_smallest_api_key
AGENT_ID=your_agent_id  # Create via dashboard or API
```

## Usage

### Step 1: Create Audience

```bash
python create_audience.py
```

This creates an audience and saves `AUDIENCE_ID` to `.env`.

### Step 2: Create Campaign

```bash
python create_campaign.py
```

This creates a campaign linking your agent, audience, and phone number.

### Step 3: Manage Campaign

```bash
# Start calling
python manage_campaign.py start

# Check status
python manage_campaign.py status

# Pause (can resume later)
python manage_campaign.py pause

# Stop completely
python manage_campaign.py stop

# List all campaigns
python manage_campaign.py list
```

### Optional: Add More Contacts

```bash
python add_contacts.py
```

## Code Examples

### Creating an Audience

```python
from smallestai.atoms import Audience

audience = Audience()

result = audience.create(
    name="My Contacts",
    phone_numbers=["+1234567890", "+1234567891"],
    names=[("John", "Doe"), ("Jane", "Smith")],
    description="Optional description"
)

audience_id = result["data"]["_id"]
```

### Creating a Campaign

```python
from smallestai.atoms import Campaign

campaign = Campaign()

result = campaign.create(
    name="My Campaign",
    agent_id="agent_123",
    audience_id="audience_456",
    phone_ids=["phone_789"],  # Get from get_phone_numbers()
    max_retries=3,
    retry_delay=15
)

campaign_id = result["data"]["_id"]
```

### Campaign Control

```python
campaign = Campaign()

# Start
campaign.start(campaign_id)

# Pause
campaign.pause(campaign_id)

# Stop
campaign.stop(campaign_id)

# Get status
status = campaign.get(campaign_id)
```

### Using AtomsClient

You can also use the unified client:

```python
from smallestai.atoms import AtomsClient

client = AtomsClient()

# Audience operations
client.audience.create(...)

# Campaign operations
client.campaign.create(...)
client.campaign.start(campaign_id)

# Get phone numbers
phones = client.get_phone_numbers()
```

## Campaign Settings

| Setting | Type | Description |
|---------|------|-------------|
| `name` | string | Campaign name |
| `agent_id` | string | Agent to use for calls |
| `audience_id` | string | Contact list to call |
| `phone_ids` | list | Outbound phone number IDs |
| `max_retries` | int | Retry attempts if no answer (0-10) |
| `retry_delay` | int | Minutes between retries (1-1440) |

## Best Practices

1. **Test First** - Use a small audience to test your agent
2. **Monitor Status** - Check campaign progress regularly
3. **Handle Retries** - Configure appropriate retry settings
4. **Respect Regulations** - Follow TCPA and local calling regulations
5. **Track Results** - Use the analytics cookbook to analyze outcomes

## Next Steps

- See [Analytics](../analytics/) for call logs and metrics
- See [Knowledge Base RAG](../knowledge_base_rag/) for KB-enabled agents
