# Call Analytics

Scripts for retrieving and analyzing call data.

## Features

- **Call Logs** — Retrieve and filter call history
- **Call Details** — Get transcripts, recordings, and metadata
- **Post-Call Analytics** — Configure and retrieve AI-extracted metrics
- **Export** — Export transcripts for external analysis

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage). Add `SMALLEST_API_KEY` to your `.env`.

## Usage

```bash
uv pip install -r requirements.txt
```

### List Recent Calls

```bash
# Get last 10 calls
uv run get_calls.py

# Filter by agent
uv run get_calls.py --agent agent_123

# Filter by status
uv run get_calls.py --status completed

# Get more results
uv run get_calls.py --limit 50 --page 1
```

### Get Call Details

```bash
# Get full details including transcript
uv run get_call_details.py CALL-1768155029217-0bae45
```

### Configure Post-Call Analytics

```bash
# Show current configuration
uv run configure_post_call.py agent_123 --show

# Configure sample metrics
uv run configure_post_call.py agent_123
```

### Export Transcripts

```bash
# Export as text
uv run export_transcripts.py --output transcripts.txt

# Export as JSON
uv run export_transcripts.py --output transcripts.json --format json

# Filter and limit
uv run export_transcripts.py --agent agent_123 --limit 50 --output data.json
```

## Recommended Usage

- Analyzing call outcomes, exporting transcripts, and setting up post-call metrics for quality monitoring
- Configuring custom disposition metrics (ENUM, STRING, BOOLEAN, etc.)
- For real-time in-call analytics, [Background Agent](../background_agent/) is recommended

## Key Snippets

### Post-Call Analytics Configuration

Define custom metrics that are extracted from every call:

```python
from smallestai.atoms.helpers import CallAnalytics

call = CallAnalytics()

call.set_post_call_config(
    agent_id="agent_123",
    summary_prompt="Summarize the key points of this call.",
    disposition_metrics=[
        {
            "identifier": "outcome",
            "dispositionMetricPrompt": "What was the call outcome?",
            "dispositionMetricType": "ENUM",
            "choices": ["Resolved", "Escalated", "Callback"]
        },
        {
            "identifier": "customer_name",
            "dispositionMetricPrompt": "What is the customer's name?",
            "dispositionMetricType": "STRING"
        },
        {
            "identifier": "satisfied",
            "dispositionMetricPrompt": "Was the customer satisfied?",
            "dispositionMetricType": "BOOLEAN"
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

### Get Calls with Filters

```python
from smallestai.atoms.helpers import CallAnalytics

call = CallAnalytics()

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

## Scripts Included

```
analytics/
├── get_calls.py             # List calls with filtering options
├── get_call_details.py      # Get detailed info for a specific call
├── configure_post_call.py   # Set up post-call analytics
└── export_transcripts.py    # Export transcripts to file
```

## Best Practices

1. **Filter Early** — Use query parameters to reduce data transfer
2. **Paginate** — Use page/limit for large datasets
3. **Configure Analytics** — Set up metrics before running calls
4. **Export Regularly** — Archive transcripts for long-term analysis
5. **Handle Missing Data** — Not all fields are always present

## API Reference

- [Analytics — Overview](https://docs.smallest.ai/atoms/developer-guide/operate/analytics/overview)

## Next Steps

- [Campaigns](../campaigns/) — Outbound call management
- [Background Agent](../background_agent/) — Real-time in-call analytics
