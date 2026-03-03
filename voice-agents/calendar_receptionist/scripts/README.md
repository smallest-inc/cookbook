# Atoms Agent Scripts

Quick reference for duplicating the Calendar Receptionist agent. See the main [README](../README.md) for full setup.

## For anyone who clones the repo

### 1. Set up environment

```bash
cd server && cp .env.example .env
# Edit .env with your SMALLEST_API_KEY, GCP credentials, etc.
```

### 2. Run ngrok (get your webhook URL)

```bash
ngrok http 4000
# Copy your URL, e.g. https://abc123.ngrok-free.dev
```

### 3. Duplicate the agent

```bash
npm run setup-atoms -- https://your-ngrok.ngrok-free.dev
```

Or set `PUBLIC_WEBHOOK_BASE_URL` in `server/.env` and run:

```bash
npm run setup-atoms
```

This creates a new agent with the same workflow, voice, prompt, and API config—only the webhook URL is yours.

### 4. Add the new agent ID

The script outputs the new agent ID. Add it to both env files:

**server/.env:**
```
SMALLEST_RECEPTIONIST_AGENT_ID=<the-new-agent-id>
```

**client/.env:** Create from example if needed, then add:
```bash
cp client/.env.example client/.env   # if client/.env doesn't exist
# Edit: VITE_SMALLEST_ASSISTANT_ID=<the-new-agent-id>
```

### 5. Run the app

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

---

## What gets duplicated

| From export | Applied on setup |
|------------|------------------|
| Agent name, description | ✓ |
| Global prompt | ✓ |
| Voice (synthesizer) | ✓ |
| Workflow (nodes, API calls) | ✓ |
| API URLs | Replaced with your `{{WEBHOOK_BASE_URL}}` |

---

## Notes

- Each person needs their own Smallest.ai account and API key
- If your agent ID returns 404, run `npm run list-atoms-agents` to find the correct ID
- The default `atoms-agent-config.json` works even if export hasn't been run
