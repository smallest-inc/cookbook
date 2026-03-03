#!/usr/bin/env node
/**
 * Calendar Receptionist Webhooks
 *
 * Express server with two endpoints called by Atoms workflow:
 *   POST /webhooks/check-availability - returns available slots for a day
 *   POST /webhooks/confirm-meeting - books a meeting and returns confirmation
 *
 * This minimal example returns mock data. For real Google Calendar integration,
 * see the full project: https://github.com/malikaa-27/calendarAI
 *
 * Usage: npm start (or node server.js)
 * Requires: SMALLEST_API_KEY in .env (for reference; server runs without it)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const TZ = process.env.CALENDAR_TIMEZONE || 'America/Los_Angeles';

// Build mock slots for next 3 days, 9 AM–6 PM, 30-min intervals
function buildMockSlots(daysAhead = 3) {
  const slots = [];
  const now = new Date();
  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    for (let h = 9; h < 18; h++) {
      day.setHours(h, 0, 0, 0);
      const start = new Date(day);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      if (start > now) {
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
  }
  return slots.slice(0, 12);
}

// Format slots for voice: "Friday Feb 27: 11 AM, 11:30 AM, 12 PM"
function formatSummary(slots) {
  if (!slots.length) return 'No availability.';
  const byDay = {};
  for (const s of slots) {
    const d = new Date(s.start);
    const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: TZ });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(time);
  }
  return Object.entries(byDay)
    .map(([day, times]) => `${day}: ${times.join(', ')}`)
    .join('. ');
}

// POST /webhooks/check-availability
// Body: { proposedSlots: [{start, end}], targetDay?: "tomorrow 2 pm" }
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

// POST /webhooks/confirm-meeting
// Body: { start, end, clientEmail, purpose, attendeeName }
app.post('/webhooks/confirm-meeting', (req, res) => {
  const { start, end, clientEmail, purpose, attendeeName } = req.body || {};
  if (!start || !end || !clientEmail) {
    return res.status(400).json({
      error: 'Missing required fields: start, end, clientEmail',
      confirmationMessage: "I'm sorry, I couldn't complete the booking. Could you please provide your email and preferred time?",
    });
  }

  const startDate = new Date(start);
  const formatted = startDate.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });

  res.json({
    ok: true,
    confirmationMessage: `All set! Your meeting is scheduled for ${formatted}. We've sent a confirmation to ${clientEmail}.`,
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Calendar Receptionist webhooks listening on port ${PORT}`);
  console.log('Endpoints: POST /webhooks/check-availability, POST /webhooks/confirm-meeting');
});
