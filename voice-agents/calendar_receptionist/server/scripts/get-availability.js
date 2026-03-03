#!/usr/bin/env node
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--start') out.start = args[++i];
    else if (a === '--end') out.end = args[++i];
    else if (a === '--slot') out.slot = parseInt(args[++i], 10);
    else if (a === '--calendar') out.calendar = args[++i];
    else if (a === '--key') out.key = args[++i];
  }
  return out;
}

function toISO(d) { return new Date(d).toISOString(); }

function subtractBusyRanges(rangeStart, rangeEnd, busyRanges) {
  // busyRanges assumed sorted by start
  const free = [];
  let cursor = rangeStart;
  for (const b of busyRanges) {
    const bStart = new Date(b.start).getTime();
    const bEnd = new Date(b.end).getTime();
    if (bEnd <= cursor) continue;
    if (bStart > cursor) {
      free.push({ start: cursor, end: Math.min(bStart, rangeEnd) });
    }
    cursor = Math.max(cursor, bEnd);
    if (cursor >= rangeEnd) break;
  }
  if (cursor < rangeEnd) free.push({ start: cursor, end: rangeEnd });
  return free;
}

function splitIntoSlots(freeRanges, slotMinutes) {
  const slots = [];
  const slotMs = slotMinutes * 60 * 1000;
  for (const r of freeRanges) {
    let s = r.start;
    while (s + slotMs <= r.end) {
      slots.push({ start: new Date(s).toISOString(), end: new Date(s + slotMs).toISOString() });
      s += slotMs;
    }
  }
  return slots;
}

async function main() {
  const args = parseArgs();
  const keyPath = args.key || process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '../../Downloads/receptionist-488320-9819a4711810.json');
  if (!fs.existsSync(keyPath)) {
    console.error('Key file not found at', keyPath);
    process.exit(2);
  }
  const key = require(keyPath);
  // calendar is the target calendar to check (e.g., user email). Default to service account email.
  const calendar = args.calendar || key.client_email;
  const slotMinutes = args.slot || 30;
  const start = args.start ? new Date(args.start) : new Date();
  const end = args.end ? new Date(args.end) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const jwt = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    // Authenticate as the service account itself. The service account must have access
    // to the target calendar (shared with service account) to query it.
    subject: key.client_email
  });

  try {
    await jwt.authorize();
  } catch (e) {
    console.error('Auth failed:', e.message || e);
    process.exit(1);
  }

  const cal = google.calendar({ version: 'v3', auth: jwt });
  const resp = await cal.freebusy.query({
    requestBody: {
      timeMin: toISO(start),
      timeMax: toISO(end),
      items: [{ id: calendar }]
    }
  });

  const busy = (resp.data.calendars && resp.data.calendars[calendar] && resp.data.calendars[calendar].busy) || [];
  busy.sort((a, b) => new Date(a.start) - new Date(b.start));

  const freeRanges = subtractBusyRanges(start.getTime(), end.getTime(), busy);
  const slots = splitIntoSlots(freeRanges, slotMinutes);

  console.log(JSON.stringify({ calendar, start: start.toISOString(), end: end.toISOString(), slotMinutes, availableSlots: slots }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
