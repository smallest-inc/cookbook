# API Functions Explained

This document explains every part of each API call and how it fits into the Calendar Receptionist flow.

---

## Overview: How the Web App Works

```
Caller (phone) → Atoms Voice Agent → This API (webhooks) → Google Calendar + Email
```

1. **Caller** dials in and talks to the Atoms AI receptionist.
2. **Atoms** calls our API when it needs to check availability or book a meeting.
3. **Our API** talks to Google Calendar and (optionally) sends confirmation emails.
4. **Caller** gets a calendar invite with Google Meet.

---

## API 1: Check Availability

**Endpoint:** `POST /webhooks/check-availability`  
**Purpose:** Find which time slots are free on the calendar so the agent can offer them to the caller.

### Request Body

| Field | Type | Purpose |
|-------|------|---------|
| `proposedSlots` | `[{start, end}, ...]` | Optional. Pre-defined slots to check (e.g. from a previous step). |
| `targetDay` | `string` | Optional. What the caller said: "today 2 pm", "tomorrow", "Friday 3 pm", "March 15", "next Monday", etc. |

### Step-by-Step Flow

#### 1. Validate and parse the request

```javascript
checkAvailabilitySchema.safeParse(req.body)
```

- `proposedSlots`: array of `{start, end}` (ISO strings). Each slot must be 30 min, end > start.
- `targetDay`: optional string. If present, it’s used to infer slots.

#### 2. Handle unsubstituted template variables

```javascript
if (targetDay && isUnsubstitutedTemplate(targetDay)) targetDay = undefined;
```

- If Atoms sends `{{day_time_mentioned_by_user}}` literally (variable not filled), we treat it as missing and fall back to defaults.

#### 3. Decide which slots to check

```javascript
slotsToCheck = proposedSlots.length > 0 ? proposedSlots : inferredSlots
if (slotsToCheck.length === 0) slotsToCheck = buildDefaultSlots(3)
```

- **proposedSlots:** use them if provided.
- **else:** try to infer slots from `targetDay` (e.g. "Friday 3 pm" → slots around that time).
- **else:** use `buildDefaultSlots(3)` → next 3 days, 9 AM–5 PM, 30-min intervals.

#### 4. `buildSlotsFromTargetDay(targetDay)`

- Parses `targetDay` with `parseDayTimeExpression` (e.g. "today 2 pm", "tomorrow", "March 15 11 am").
- Builds slots around that time (±2 hours, 30-min steps).
- Uses `toUtcInCalendarTz()` so times are in the calendar timezone (e.g. `America/Los_Angeles`).
- Returns up to 9 slots.

#### 5. `buildDefaultSlots(daysAhead)`

- Uses `daysAhead` days (default 3).
- For each day: 9 AM–5 PM, 30-min slots.
- Uses `toUtcInCalendarTz()` so 9 AM is 9 AM in the calendar timezone.
- Returns up to 24 slots.

#### 6. `googleCalendarService.findAvailableSlots(slotsToCheck)`

- Calls Google Calendar API `freebusy.query`.
- Gets busy times for the calendar.
- Filters out any proposed slot that overlaps busy time.
- Returns only free slots.

#### 7. Format for the voice agent

```javascript
formatIsoRange(..., tz)  // "Monday, Mar 2, 2026, 11 AM - 11:30 AM"
formatAvailableSummaryCompact(..., tz)  // "Monday Mar 2: 11 AM, 11:30 AM, 12 PM"
```

- Uses `CALENDAR_TIMEZONE` so times match the user’s calendar.
- Uses "9 AM" instead of "9:00 AM" for better TTS.

#### 8. Response

| Field | Purpose |
|-------|---------|
| `available` | Array of free slots `{start, end}` (ISO). |
| `formatted` | Full readable strings per slot. |
| `available_summary` | Compact string for the agent to speak. |
| `first_slot_start` / `first_slot_end` | First slot for Atoms (e.g. `$.first_slot_start`). |
| `usedFallback` | Whether default slots were used. |
| `usedTargetDayInference` | Whether slots came from `targetDay`. |

---

## API 2: Confirm Meeting

**Endpoint:** `POST /webhooks/confirm-meeting`  
**Purpose:** Create the event and send confirmation emails.

### Request Body

| Field | Type | Purpose |
|-------|------|---------|
| `start` | ISO string | Start of the chosen slot. |
| `end` | ISO string | End of the chosen slot. |
| `clientEmail` | email | Caller’s email. |
| `purpose` | string | Optional. Meeting title. |
| `attendeeName` | string | Optional. Caller’s name. |

### Step-by-Step Flow

#### 1. `tryResolveConfirmMeetingBody(body)`

- **Invalid start/end:** if duration is wrong (e.g. same start/end), fixes `end` to `start + 30 min`.
- **Unsubstituted template:** if `start`/`end` still `{{...}}`, uses `availability.json` first slot.
- **Unsubstituted template:** if `clientEmail` is `{{...}}`, uses `guest@example.com`.
- **Unsubstituted template:** if `purpose` or `attendeeName` is `{{...}}`, uses defaults.

#### 2. Validate request

```javascript
confirmMeetingSchema.safeParse(body)
```

- Ensures `start`, `end`, `clientEmail` are valid and `end > start`.

#### 3. Re-check availability

```javascript
availableForRequestedSlot = findAvailableSlots([{start, end}])
if (availableForRequestedSlot.length === 0) → 409 Conflict
```

- Prevents double-booking if the slot became busy between check and confirm.

#### 4. `googleCalendarService.createEvent(...)`

- Creates the event on the calendar.
- Adds Google Meet via `conferenceData.createRequest`.
- Adds the caller as attendee.
- Sends updates to attendees (`sendUpdates: 'all'`).
- If domain-wide delegation fails, creates the event without attendees (fallback).

#### 5. Sends confirmation email

```javascript
emailService.sendBookingConfirmation({
  to: [clientEmail, receiverEmail],
  meetLink,
  organizerEmail,
  ...
})
```

- Sends to both caller and receiver.
- Includes `.ics` attachment.
- Includes Google Meet link in body and `.ics`.

#### 6. Response

| Field | Purpose |
|-------|---------|
| `ok` | `true` on success. |
| `event` | Created event from Google Calendar. |
| `email` | `{sent: true/false}`. |
| `confirmationMessage` | Text for the agent to speak. |

---

## Google Calendar Service

### `findAvailableSlots(proposedSlots)`

| Part | Purpose |
|------|---------|
| `timeMax` | End of the query range (up to 2 years from now). |
| `freebusy.query` | Asks Google which times are busy. |
| `chunking` | Splits query into ~50-day chunks (API limit). |
| `items: [{ id: targetCalendar }]` | Calendar to check. |
| `busy` | Busy intervals from the response. |
| Overlap check | For each proposed slot, checks if it overlaps any busy interval. |
| Return | Only free slots. |

### `createEvent({ start, end, summary, attendees, description })`

| Part | Purpose |
|------|---------|
| `start` / `end` | Event times (Date objects). |
| `summary` | Event title. |
| `description` | Event body (e.g. caller info). |
| `attendees` | Caller email. |
| `conferenceData` | Requests Google Meet. |
| `conferenceDataVersion: 1` | Enables conference data in the API. |
| `sendUpdates: 'all'` | Sends invites to attendees. |
| Domain-wide delegation fallback | If needed, creates event without attendees. |

---

## Email Service

### `sendBookingConfirmation(input)`

| Part | Purpose |
|------|---------|
| `to` | Recipients (caller + receiver). |
| `subject` | Subject line. |
| `text` | Plain text body. |
| `attachments` | `.ics` file for calendar import. |
| `generateIcs()` | Builds `.ics` with ORGANIZER, ATTENDEE, Meet link. |

---

## Helper Functions

| Function | Purpose |
|----------|---------|
| `toUtcInCalendarTz(d)` | Converts a date to UTC in the calendar timezone (fixes 3 AM vs 11 AM). |
| `parseDayTimeExpression(s)` | Parses phrases like "today 2 pm", "tomorrow", "March 15 11 am", "next Monday". |
| `isUnsubstitutedTemplate(s)` | Detects `{{variable}}` that wasn’t replaced. |
| `formatTimeForVoice(d)` | Formats times as "9 AM" (not "9:00 AM") for TTS. |

---

## Data Flow Summary

```
Caller: "I'd like to meet Friday at 3 pm"
    ↓
Atoms: POST /check-availability { targetDay: "Friday 3 pm" }
    ↓
API: parseDayTimeExpression → buildSlotsFromTargetDay → findAvailableSlots
    ↓
API: Returns { available_summary: "Friday Feb 27: 2:30 PM, 3 PM, 3:30 PM", ... }
    ↓
Atoms: "I have 2:30, 3, 3:30. Which works?"
    ↓
Caller: "3 pm works"
    ↓
Atoms: POST /confirm-meeting { start, end, clientEmail, purpose, attendeeName }
    ↓
API: createEvent → sendBookingConfirmation
    ↓
Caller: Gets calendar invite + email with Meet link
```
