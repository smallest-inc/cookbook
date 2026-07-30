# Campaign Management

Scripts for managing outbound calling campaigns.

## Features

- **Audience Creation** — Build contact lists for campaigns
- **Campaign Setup** — Link agents, audiences, and phone numbers
- **Campaign Control** — Start, stop, pause, and monitor
- **Contact Management** — Add contacts to existing audiences

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

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage). Add `SMALLEST_API_KEY` and `AGENT_ID` to your `.env`.

## Usage

```bash
uv pip install -r requirements.txt
```

### Step 1: Create Audience

```bash
uv run create_audience.py
```

This creates an audience and saves `AUDIENCE_ID` to `.env`.

### Step 2: Create Campaign

```bash
uv run create_campaign.py
```

This creates a campaign linking your agent, audience, and phone number.

### Step 3: Manage Campaign

```bash
# Start calling
uv run manage_campaign.py start

# Check status
uv run manage_campaign.py status

# Pause (can resume later)
uv run manage_campaign.py pause

# Stop completely
uv run manage_campaign.py stop

# List all campaigns
uv run manage_campaign.py list
```

### Optional: Add More Contacts

```bash
uv run add_contacts.py
```

## Recommended Usage

- Automated outbound calling at scale — sales outreach, appointment reminders, surveys
- Managing audiences, phone numbers, and campaign lifecycle
- For inbound call handling, [Inbound IVR](../inbound_ivr/) is recommended

## Key Snippets

### Creating an Audience

```python
from smallestai.atoms.helpers import Audience

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
from smallestai.atoms.helpers import Campaign

campaign = Campaign()

result = campaign.create(
    name="My Campaign",
    agent_id="agent_123",
    audience_id="audience_456",
    phone_ids=["phone_789"],  # Get from client.atoms.phone_numbers.list()
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

### Using the unified client

You can also use the unified `SmallestAI` client:

```python
from smallestai import SmallestAI

client = SmallestAI()

# Audience operations
client.atoms.audience.create_audience_with_csv_upload(...)

# Campaign operations
client.atoms.campaigns.create(...)
client.atoms.campaigns.start_or_resume(id=campaign_id)

# Get phone numbers
phones = client.atoms.phone_numbers.list()
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

## Scripts Included

```
campaigns/
├── create_audience.py    # Create a new audience with contacts
├── add_contacts.py       # Add contacts to existing audience
├── create_campaign.py    # Create a campaign
└── manage_campaign.py    # Start/stop/pause/status commands
```

## Best Practices

1. **Test First** — Use a small audience to test your agent
2. **Monitor Status** — Check campaign progress regularly
3. **Handle Retries** — Configure appropriate retry settings
4. **Respect Regulations** — Follow TCPA and local calling regulations
5. **Track Results** — Use the analytics cookbook to analyze outcomes

## API Reference

- [Phone Calling — Overview](https://docs.smallest.ai/atoms/developer-guide/build/calling/overview)

## Next Steps

- [Analytics](../analytics/) — Call logs and metrics for campaign results
- [Knowledge Base RAG](../knowledge_base_rag/) — KB-enabled agents
