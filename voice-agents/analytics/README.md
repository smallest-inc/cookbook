# Call Analytics

Scripts for retrieving and analyzing call data.

## Overview

This cookbook demonstrates:
- **Call Logs** - Retrieve and filter call history
- **Call Details** - Get transcripts, recordings, and metadata
- **Post-Call Analytics** - Configure and retrieve AI-extracted metrics
- **Export** - Export transcripts for external analysis

## Files

| Script | Description |
|--------|-------------|
| `get_calls.py` | List calls with filtering options |
| `get_call_details.py` | Get detailed info for a specific call |
| `configure_post_call.py` | Set up post-call analytics |
| `export_transcripts.py` | Export transcripts to file |

## Setup

1. Install dependencies:
```bash
pip install smallestai python-dotenv
```

2. Create `.env` file:
```bash
SMALLEST_API_KEY=your_smallest_api_key
```

## Usage

### List Recent Calls

```bash
# Get last 10 calls
python get_calls.py

# Filter by agent
python get_calls.py --agent agent_123

# Filter by status
python get_calls.py --status completed

# Get more results
python get_calls.py --limit 50 --page 1
```

### Get Call Details

```bash
# Get full details including transcript
python get_call_details.py CALL-1768155029217-0bae45
```

Output includes:
- Basic call info (duration, status, parties)
- Recording URLs
- Full transcript
- Post-call analytics (if configured)

### Configure Post-Call Analytics

```bash
# Show current configuration
python configure_post_call.py agent_123 --show

# Configure sample metrics
python configure_post_call.py agent_123
```

### Export Transcripts

```bash
# Export as text
python export_transcripts.py --output transcripts.txt

# Export as JSON
python export_transcripts.py --output transcripts.json --format json

# Filter and limit
python export_transcripts.py --agent agent_123 --limit 50 --output data.json
```

## Post-Call Analytics

### Configuration

Define custom metrics that are extracted from every call:

```python
from smallestai.atoms import Call

call = Call()

call.set_post_call_config(
    agent_id="agent_123",
    summary_prompt="Summarize the key points of this call.",
    disposition_metrics=[
        {
            "identifier": "outcome",
            "dispositionMetricPrompt": "What was the call outcome?",
            "dispositionValues": {"type": "ENUM"},
            "choices": ["Resolved", "Escalated", "Callback"]
        },
        {
            "identifier": "customer_name",
            "dispositionMetricPrompt": "What is the customer's name?",
            "dispositionValues": {"type": "STRING"}
        },
        {
            "identifier": "satisfied",
            "dispositionMetricPrompt": "Was the customer satisfied?",
            "dispositionValues": {"type": "BOOLEAN"}
        }
    ]
)
```

### Metric Types

| Type | Description | Example |
|------|-------------|---------|
| `STRING` | Free text | Customer name, product mentioned |
| `BOOLEAN` | True/False | Requires follow-up, issue resolved |
| `INTEGER` | Numeric | Callback count, satisfaction score |
| `ENUM` | Predefined choices | Outcome, sentiment category |
| `DATETIME` | Date/time | Callback scheduled time |

### Retrieving Analytics

After calls complete, analytics are included in call details:

```python
result = call.get_call("CALL-123")
analytics = result["data"]["postCallAnalytics"]

summary = analytics.get("summary")
disposition = analytics.get("disposition", {})

print(f"Outcome: {disposition.get('outcome')}")
print(f"Satisfied: {disposition.get('satisfied')}")
```

## Code Examples

### Get Calls with Filters

```python
from smallestai.atoms import Call

call = Call()

# Get completed calls for an agent
result = call.get_calls(
    agent_id="agent_123",
    status="completed",
    limit=50,
    page=1
)

for c in result["data"]["calls"]:
    print(f"{c['callId']}: {c['duration']}s")
```

### Get Call Transcript

```python
result = call.get_call("CALL-123")
transcript = result["data"]["transcript"]

for entry in transcript:
    role = "Agent" if entry["role"] == "assistant" else "User"
    print(f"{role}: {entry['content']}")
```

### Search Calls by ID

```python
# Batch lookup
result = call.search_calls([
    "CALL-123",
    "CALL-456",
    "CALL-789"
])
```

## Call Data Fields

| Field | Description |
|-------|-------------|
| `callId` | Unique call identifier |
| `status` | completed, failed, in_progress, etc. |
| `type` | telephony_inbound, telephony_outbound, chat |
| `duration` | Call duration in seconds |
| `from` | Caller number |
| `to` | Called number |
| `transcript` | Array of {role, content} |
| `recordingUrl` | Mono recording URL |
| `recordingDualUrl` | Stereo recording URL |
| `callCost` | Cost breakdown |
| `postCallAnalytics` | AI-extracted metrics |

## Best Practices

1. **Filter Early** - Use query parameters to reduce data transfer
2. **Paginate** - Use page/limit for large datasets
3. **Configure Analytics** - Set up metrics before running calls
4. **Export Regularly** - Archive transcripts for long-term analysis
5. **Handle Missing Data** - Not all fields are always present

## Next Steps

- See [Campaigns](../campaigns/) for outbound call management
- See [Background Agent](../background_agent/) for real-time analytics
