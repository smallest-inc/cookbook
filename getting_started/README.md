# Getting Started Example

Complete quickstart demonstrating:
- SDK initialization
- Making outbound calls
- Retrieving call analytics

## Setup

```bash
pip install smallestai python-dotenv
```

## Configure

Create `.env`:
```
SMALLEST_API_KEY=your_api_key
AGENT_ID=your_agent_id_with_phone
PHONE_NUMBER=+1234567890
```

## Run

```bash
python main.py
```

The script will:
1. Initialize the SDK client
2. Make an outbound call to your phone
3. Wait 30 seconds for conversation
4. Display call analytics
