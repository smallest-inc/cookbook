# Calendar Receptionist

A voice receptionist that schedules meetings via Atoms webhooks. The server exposes two endpoints: check availability and confirm meeting. This example uses mock data; the full project adds Google Calendar integration, agent duplication, and a React client.

## Features

- Webhook endpoints for Atoms workflow: `check-availability`, `confirm-meeting`
- Request/response shapes compatible with Atoms API nodes
- Mock slot generation for testing without Google Calendar
- Timezone-aware slot formatting for voice output

## Demo

Run the server, then use ngrok to expose it. Configure your Atoms agent to call `https://YOUR-NGROK-URL/webhooks/check-availability` and `https://YOUR-NGROK-URL/webhooks/confirm-meeting`.

## Requirements

Base dependencies are installed via `package.json`. Additionally:

- Add `SMALLEST_API_KEY` to your `.env` (for reference; the mock server runs without it)
- Node.js 18+

## Usage

```bash
cd javascript
cp ../.env.sample ../.env
# Edit ../.env if needed
npm install
npm start
```

Server runs on port 4000. Use ngrok to expose it for Atoms:

```bash
ngrok http 4000
```

## Recommended Usage

- Test the webhook contract before wiring up Google Calendar
- Use this as a reference for request/response shapes when building your Atoms workflow
- For full Google Calendar integration, React client, and agent duplication, see [calendarAI](https://github.com/malikaa-27/calendarAI)

## Key Snippets

**Check availability endpoint** — Atoms sends `targetDay` (e.g. "tomorrow 2 pm"); you return `available_summary`, `first_slot_start`, `first_slot_end`:

```javascript
app.post('/webhooks/check-availability', (req, res) => {
  const { proposedSlots = [], targetDay } = req.body || {};
  const slots = proposedSlots.length > 0 ? proposedSlots : buildMockSlots(3);
  const available = slots.filter((s) => new Date(s.start) > new Date());
  const first = available[0];

  res.json({
    available,
    available_summary: formatSummary(available),
    first_slot_start: first?.start ?? null,
    first_slot_end: first?.end ?? null,
  });
});
```

**Confirm meeting endpoint** — Atoms sends slot + attendee info; you return `confirmationMessage`:

```javascript
app.post('/webhooks/confirm-meeting', (req, res) => {
  const { start, end, clientEmail, purpose, attendeeName } = req.body || {};
  // ... validate, create event ...
  res.json({
    ok: true,
    confirmationMessage: `All set! Your meeting is scheduled for ${formatted}.`,
  });
});
```

## Example Output

```bash
$ npm start
Calendar Receptionist webhooks listening on port 4000
Endpoints: POST /webhooks/check-availability, POST /webhooks/confirm-meeting
```

```bash
$ curl -X POST http://localhost:4000/webhooks/check-availability \
  -H "Content-Type: application/json" \
  -d '{"targetDay":"tomorrow"}'
```

```json
{
  "available": [...],
  "available_summary": "Thursday Feb 26: 9:00 AM, 9:30 AM, 10:00 AM, ...",
  "first_slot_start": "2026-02-26T17:00:00.000Z",
  "first_slot_end": "2026-02-26T17:30:00.000Z"
}
```

## Structure

```
calendar_receptionist/
├── javascript/
│   ├── server.js      # Express webhook server
│   └── package.json
├── .env.sample
└── README.md
```

## Documentation

- [Atoms docs](https://atoms-docs.smallest.ai/dev)
- [Full project: calendarAI](https://github.com/malikaa-27/calendarAI) — Google Calendar, agent duplication, React client

## Next Steps

- [appointment_scheduler](../appointment_scheduler/) — Cal.com integration with Atoms SDK (Python)
- [getting_started](../getting_started/) — Create your first Atoms agent
