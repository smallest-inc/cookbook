# Webhook payload examples

## "Can't fetch backend data" troubleshooting

When the agent says "can't fetch backend data" or "not getting backend calendar info", the API call from Atoms to your server is failing.

### Use ngrok

1. **Start ngrok** – `ngrok http 4000` (keep it running in a separate terminal)
2. **URL in Atoms** – Both getAvailableSlots and confirmMeeting must use your ngrok URL (e.g. `https://xxxx.ngrok-free.dev`). Free ngrok URLs change when you restart.
3. **Header** – Add `ngrok-skip-browser-warning: true` to both API calls. Required.
4. **Timeout** – Set to **10000** (10 seconds) for both API calls.
5. **See ATOMS_CONFIG_NOW.txt** – Exact URLs and headers to copy.

## check-availability

Request body (from Smallest.ai Atoms to your webhook):

```json
{
  "proposedSlots": [],
  "targetDay": "Thursday 2 pm"
}
```

- **proposedSlots**: Array of `{ start, end }` ISO strings to check.
- **targetDay**: Optional. Natural language like `"Thursday 2 pm"` or `"Friday 10 am"`. If Atoms sends an unsubstituted variable (e.g. `"{{day_time_mentioned_by_user}}"`), the backend falls back to the next 3 days (9am–5pm) so the agent still gets availability.

Example with proposed slots:

```json
{
  "proposedSlots": [
    { "start": "2026-03-01T10:00:00.000Z", "end": "2026-03-01T10:30:00.000Z" },
    { "start": "2026-03-01T15:00:00.000Z", "end": "2026-03-01T15:30:00.000Z" }
  ]
}
```

Response body (your server):

```json
{
  "available": [
    { "start": "2026-03-01T15:00:00.000Z", "end": "2026-03-01T15:30:00.000Z" }
  ]
}
```

## confirm-meeting

Request body (from Smallest.ai when the agent finalizes the booking):

```json
{
  "start": "2026-03-01T15:00:00.000Z",
  "end": "2026-03-01T15:30:00.000Z",
  "clientEmail": "client@example.com",
  "purpose": "Discuss project scope",
  "attendeeName": "Pat"
}
```

**Fallback when Atoms sends unsubstituted variables:** If `start`, `end`, or `clientEmail` contain `{{...}}` (e.g. `{{selected_slot_start_iso}}`), the backend will:
- Use the first slot from the last check-availability response for `start`/`end`
- Use `guest@example.com` for `clientEmail`

This lets calendar invites be created even when Atoms variable mapping isn't configured. For correct slot selection and real attendee emails, see the Atoms setup guide below.

Response (your server):

```json
{
  "ok": true,
  "event": { /* Google Calendar Event resource */ },
  "email": { "sent": true },
  "confirmationMessage": "Your meeting is confirmed for Thursday, Feb 26, 2026, 12:30 PM - 1:00 PM. You'll receive a calendar invite at client@example.com."
}
```

**confirmationMessage** – A ready-to-say string for the agent. In Atoms, add Response Variable Extraction: path `$.confirmationMessage` → variable `confirmation_message`, then use it in your prompt or closing message so the agent says it to the caller.

---

## Atoms setup: passing caller email and slot to confirm-meeting

To get the caller's real email (and correct slot) into the calendar invite, configure Atoms so variables are substituted before the confirm-meeting API is called.

### If you use a Single Prompt agent

1. Open your agent in the Atoms dashboard.
2. In the **Config Panel** (right sidebar), find **API Calls** and toggle it ON.
3. Click the ⚙️ (gear) icon to open API call settings.
4. Find the **confirm-meeting** (or confirmMeeting) API call and click to edit it. If it doesn't exist, click **+ Add API Call** and create it with:
   - **Name:** `confirm_meeting`
   - **Description:** "Confirm the meeting when the caller has chosen a time slot and provided their email"
   - **URL:** `https://YOUR_NGROK_URL/webhooks/confirm-meeting`
   - **Method:** POST
   - **Headers:** `Content-Type: application/json`, `ngrok-skip-browser-warning: true`
5. In the **LLM Parameters** section, click **+ Add Parameter** for each of these:

   | Parameter name        | Description (what the AI should extract)                          |
   |-----------------------|-------------------------------------------------------------------|
   | `client_email`       | "The caller's email address for sending the calendar invite"     |
   | `selected_slot_start_iso` | "The ISO start time of the slot the caller chose (e.g. 2026-03-01T15:00:00.000Z)" |
   | `selected_slot_end_iso`   | "The ISO end time of the slot the caller chose (e.g. 2026-03-01T15:30:00.000Z)" |
   | `caller_name`        | "The caller's name"                                               |
   | `meeting_purpose`    | "What the meeting is about"                                       |

6. In the **Body** field, use those parameter names as variables:

   ```json
   {
     "start": "{{selected_slot_start_iso}}",
     "end": "{{selected_slot_end_iso}}",
     "clientEmail": "{{client_email}}",
     "purpose": "{{meeting_purpose}}",
     "attendeeName": "{{caller_name}}"
   }
   ```

   The parameter name (e.g. `client_email`) becomes the variable `{{client_email}}` in the body.

7. In your agent **prompt**, instruct the AI to:
   - Ask for the caller's email before confirming: e.g. "What's the best email to send the calendar invite to?"
   - Use the exact start/end from the getAvailableSlots response when the caller picks a slot.

8. For **getAvailableSlots**, add **Response Variable Extraction** so the chosen slot is available:
   - Response path: `$.first_slot_start` → Variable: `selected_slot_start_iso` (or similar)
   - Response path: `$.first_slot_end` → Variable: `selected_slot_end_iso`

9. Save the API call and the agent.

### If you use a Conversational Flow (workflow) agent

1. Open your agent and go to the **Workflow** tab.
2. Add a **Default** node before the confirm-meeting API call that asks: "What's the best email to send the calendar invite to?"
3. In that node's **Branching** or configuration, set **Store response as** (or equivalent) to a variable named `client_email`.
4. Add a similar node for the caller's name if you want it, and store it as `caller_name`.
5. Click the **API Call** node that posts to confirm-meeting.
6. In the **Body** field, use variables that exist in your flow:

   ```json
   {
     "start": "{{selected_slot_start_iso}}",
     "end": "{{selected_slot_end_iso}}",
     "clientEmail": "{{client_email}}",
     "purpose": "{{meeting_purpose}}",
     "attendeeName": "{{caller_name}}"
   }
   ```

7. Ensure `selected_slot_start_iso` and `selected_slot_end_iso` come from the **getAvailableSlots** API node:
   - In that node, use **Extract Response Data** (or Response Variable Extraction).
   - Variable name: `selected_slot_start_iso`, JSONPath: `$.first_slot_start`
   - Variable name: `selected_slot_end_iso`, JSONPath: `$.first_slot_end`
8. Connect the flow so: Ask for email → getAvailableSlots → User picks slot → confirm-meeting (with all variables populated).
