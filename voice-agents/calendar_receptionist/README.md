# Calendar Receptionist

A voice receptionist that schedules meetings via phone. Callers speak to an Atoms agent, which checks **Google Calendar** availability and books meetings through webhook APIs. Includes a React web client with the Atoms widget and one-command agent duplication.

## Demo


https://github.com/user-attachments/assets/daee2c15-8687-4ee9-b04c-43f9a1524c89

## Features

- **Google Calendar** — Live availability and booking; events appear on your calendar
- **Agent duplication** — `npm run setup-atoms` creates a new agent with workflow, voice, and prompt
- **Web client** — React app with Atoms widget for testing
- **Webhooks** — Express server: `/webhooks/check-availability`, `/webhooks/confirm-meeting`
- **Optional emails** — SMTP config for booking confirmations

## Requirements

- Node.js 18+
- [Smallest.ai](https://smallest.ai) account + API key
- [Google Cloud](https://console.cloud.google.com/) — Calendar API, service account
- [ngrok](https://ngrok.com) (free tier) for local webhooks

## Usage

### 1. Install

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Set up environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit server/.env with SMALLEST_API_KEY, GCP credentials (see below)
```

### 3. Google Cloud

1. Enable **Google Calendar API**
2. Create a **Service Account** → download JSON
3. **Personal Gmail:** Share your calendar with the service account email ("Make changes to events")
4. Add `client_email`, `private_key`, `project_id` to `server/.env`; set `GCP_SUBJECT_EMAIL` to your Gmail

### 4. Run server and ngrok

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
ngrok http 4000
# Copy your HTTPS URL
```

### 5. Duplicate the agent

```bash
npm run setup-atoms -- https://YOUR-NGROK-URL
```

Add the output agent ID to `server/.env` and `client/.env`.

### 6. Run the client

```bash
cd client && npm run dev
```

Open the client in your browser and test the voice agent.

## Structure

```
calendar_receptionist/
├── server/           # Express + Google Calendar + webhooks
├── client/           # React + Atoms widget
├── scripts/          # setup-atoms, export-atoms, list-agents
├── atoms-agent-config.json
├── atoms-agent-workflow.json   # Fallback for setup script
├── AGENT_PROMPT.txt            # Full prompt template (manual setup)
├── ATOMS_CONFIG_NOW.txt        # Quick reference for Atoms config
├── PRONUNCIATION_RULES.md      # Voice pronunciation rules
├── .env.sample
└── README.md
```

## Key Snippets

**Webhook: check availability**

```javascript
// POST /webhooks/check-availability
// Body: { proposedSlots: [], targetDay?: "tomorrow 2 pm" }
// Returns: { available_summary, first_slot_start, first_slot_end }
```

**Webhook: confirm meeting**

```javascript
// POST /webhooks/confirm-meeting
// Body: { start, end, clientEmail, purpose, attendeeName }
// Returns: { confirmationMessage }
```

## Documentation

- [Atoms docs](https://atoms-docs.smallest.ai/dev)

## Next Steps

- [appointment_scheduler](../appointment_scheduler/) — Cal.com integration with Atoms SDK (Python)
- [getting_started](../getting_started/) — Create your first Atoms agent
