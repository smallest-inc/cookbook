# 📅 Appointment Scheduler — Voice-Powered Clinic Receptionist

A voice agent that checks **real calendar availability** on [Cal.com](https://cal.com), negotiates time slots with the caller, and books appointments — all visible in your Cal.com dashboard.

> **The key pattern:** The LLM handles conversation, the `CalcomClient` handles calendar truth. The agent never invents availability — every slot check and booking goes through your live Cal.com calendar. Patients can book new appointments, check existing ones, and get intelligent alternatives when their preferred time is taken.

---

## Example Interaction

```
Ria:   Hello! Welcome to Smallest Health Clinic. I'm Ria, the receptionist.
       Would you like to book an appointment, or check an existing one?

You:   I'd like to see a doctor tomorrow at 5pm.

       ┌── resolve_date("tomorrow") → "2026-02-13" ──────────────────────┐
       └─────────────────────────────────────────────────────────────────-─┘

       ┌── check_slot(date="2026-02-13", time="17:00") ──────────────────┐
       │ Cal.com API: GET /v2/slots/available                             │
       │ Result: BUSY — alternatives: ["15:30", "18:00", "19:30"]         │
       └─────────────────────────────────────────────────────────────────-─┘

Ria:   5 PM tomorrow is taken, unfortunately. But I have openings at
       3:30 PM, 6:00 PM, and 7:30 PM — which works best for you?

You:   7:30 works. My name is Rahul.

       ┌── book_appointment(patient_name="Rahul",                       ─┐
       │     date="2026-02-13", time="19:30", reason="General checkup")   │
       │ Cal.com API: POST /v2/bookings → booking created ✓               │
       └─────────────────────────────────────────────────────────────────-─┘

Ria:   All set! Thursday February 13th at 7:30 PM for a general checkup.
       You'll see the confirmation in your calendar. Anything else?

You:   Actually, do I have any other appointments this week?

       ┌── resolve_date("this week") → "2026-02-12" ─────────────────────┐
       └─────────────────────────────────────────────────────────────────-─┘

       ┌── find_appointment(date="2026-02-13", patient_name="Rahul") ────┐
       │ Cal.com API: GET /v2/bookings?status=upcoming                    │
       │ Result: 1 booking — Rahul, Feb 13 at 7:30 PM                    │
       └─────────────────────────────────────────────────────────────────-─┘

Ria:   Yes! You have one appointment — Thursday February 13th at 7:30 PM.
       That's the one we just booked. Would you like to do anything else?

You:   No, that's all. Thanks!

       ┌── end_call() ───────────────────────────────────────────────────┐
       └─────────────────────────────────────────────────────────────────-─┘

Ria:   You're welcome, Rahul! See you Thursday. Goodbye!
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Cal.com integration** | Live calendar — bookings appear in your Cal.com dashboard |
| **Slot negotiation** | Busy slots return nearest alternatives sorted by proximity |
| **Booking lookup** | Search existing appointments by name and/or date |
| **Natural date resolution** | "tomorrow", "tuesday", "12 feb", "next wednesday" → actual dates |
| **Timezone-aware** | Correctly converts between UTC (Cal.com) and local time (configurable) |
| **Multi-round chaining** | resolve_date → check_slot → book_appointment in one turn |
| **Single doctor** | Clean, focused — one event type, one calendar |

---

## Smart Date Resolution

This is a **phone call** — patients say dates naturally. The agent resolves them before hitting the calendar:

| What the caller says | What the tool resolves |
|---------------------|----------------------|
| "tomorrow" | `2026-02-13` |
| "tuesday" | `2026-02-17` (next Tuesday) |
| "12 feb" | `2026-02-12` (today) |
| "march 4th" | `2026-03-04` |
| "next wednesday" | `2026-02-18` |

The agent **always** calls `resolve_date` first — it never constructs dates on its own. The resolver uses `dateparser` for partial dates and prefers the current period so "12 feb" doesn't resolve to next year.

---

## Requirements

- Python ≥ 3.10
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Smallest AI API key](https://app.smallest.ai)
- A [Cal.com API key](https://cal.com) + Event Type ID

### Dependencies

```
smallestai >= 4.3.0
httpx
dateparser
```

---

## Usage

### 1. Install

```bash
uv pip install -r requirements.txt
```

### 2. Set environment variables

```bash
# Agent
export OPENAI_API_KEY=sk-...
export SMALLEST_API_KEY=...

# Cal.com
export CAL_API_KEY=cal_live_...
export CAL_EVENT_TYPE_ID=12345
```

Or create a `.env` file:

```env
OPENAI_API_KEY=sk-...
SMALLEST_API_KEY=...
CAL_API_KEY=cal_live_...
CAL_EVENT_TYPE_ID=12345
```

### 3. Run

```bash
uv run app.py
```

### 4. Test

```bash
smallestai agent-crew chat
```

Try: "Can I get an appointment at 5pm tomorrow?" — see slot negotiation in action.

### 5. Deploy

```bash
smallestai agent-crew deploy --entry app.py
```

---

## Setting Up Cal.com

### Step 1: Create a Cal.com account

Go to [cal.com](https://cal.com) and sign up (free tier works).

### Step 2: Create an Event Type

1. Go to **Event Types** → **New Event Type**
2. Set the title (e.g. "Doctor Appointment"), duration (30 min), and your availability hours
3. Save — note the **Event Type ID** from the URL:

```
https://app.cal.com/event-types/12345
                                ─────
                                this is your Event Type ID
```

### Step 3: Generate an API Key

1. Go to **Settings** → **Developer** → **API Keys** → **Create**
2. Copy the key (starts with `cal_live_...`)

### Step 4: Set environment variables and run

```bash
export CAL_API_KEY=cal_live_...
export CAL_EVENT_TYPE_ID=12345
uv run app.py
```

After booking an appointment over the phone, check your Cal.com dashboard — the booking will appear with patient name, reason, and time.

### Optional: Set timezone

By default, the agent uses `Asia/Kolkata`. To change:

```bash
export CAL_TIMEZONE=America/New_York
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          CrewSession                             │
│                                                                  │
│  ┌───────────────────────┐     ┌──────────────────────────────┐  │
│  │  CalcomClient          │     │  SchedulerAgent              │  │
│  │  (Cal.com v2 API)      │◄────│  OutputCrewNode              │  │
│  │                        │     │                              │  │
│  │  Methods:              │     │  Tools:                      │  │
│  │  • get_available_slots │     │  • resolve_date              │  │
│  │  • check_slot          │     │  • check_slot                │  │
│  │  • create_booking      │     │  • get_available_slots       │  │
│  │  • get_bookings        │     │  • book_appointment          │  │
│  │                        │     │  • find_appointment          │  │
│  │  Features:             │     │  • end_call                  │  │
│  │  • Timezone conversion │     │                              │  │
│  │  • Alternative sorting │     │  LLM:                        │  │
│  │  • Fuzzy name search   │     │  • Slot negotiation          │  │
│  └────────────────────────┘     │  • Natural date resolution   │  │
│                                 └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Lines | Description |
|------|-------|-------------|
| `app.py` | ~61 | Entry point — creates CalcomClient + SchedulerAgent |
| `scheduler_agent.py` | ~353 | OutputCrewNode with calendar tools, date resolver, multi-round chaining |
| `calcom_client.py` | ~465 | Cal.com v2 API client — slots, bookings, timezone conversion |
| `requirements.txt` | ~3 | Dependencies |

---

## How It Works

### 1. Session Setup (`app.py`)

The Cal.com client and agent are created per session:

```python
calcom = CalcomClient()  # reads env vars automatically

agent = SchedulerAgent(calcom=calcom)
session.add_node(agent)
await session.start()
```

### 2. Date Resolution (`scheduler_agent.py`)

Every date goes through `resolve_date` — the LLM never constructs dates itself:

```python
def resolve_date_reference(ref: str) -> str:
    """Resolve 'tomorrow', 'tuesday', '12 feb', etc. to YYYY-MM-DD."""
    today = datetime.now().date()

    if ref_lower == "tomorrow":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # Weekday names
    if clean in WEEKDAYS:
        days_ahead = WEEKDAYS[clean] - today.weekday()
        if days_ahead <= 0: days_ahead += 7
        return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # Partial dates: "12 feb", "march 4th" — via dateparser
    parsed = dateparser.parse(ref, settings={"PREFER_DATES_FROM": "current_period"})
    if parsed:
        return parsed.date().strftime("%Y-%m-%d")
```

### 3. Slot Checking with Timezone Conversion (`calcom_client.py`)

Cal.com returns UTC times. The client converts everything to your local timezone:

```python
async def get_available_slots(self, date: str, count: int = 5):
    local_tz = ZoneInfo(self.timezone)
    # Query boundaries in UTC
    day_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=local_tz)
    start_time = day_start.astimezone(ZoneInfo("UTC")).strftime(...)

    # Convert returned slots to local time
    for s in raw_slots:
        dt_utc = datetime.fromisoformat(s["time"].replace("Z", "+00:00"))
        dt_local = dt_utc.astimezone(local_tz)
        slots.append({"start_time": dt_local.strftime("%H:%M"), ...})
```

### 4. Smart Alternative Suggestions (`calcom_client.py`)

When a slot is busy, the client finds the 3 nearest available times:

```python
async def check_slot(self, date: str, time: str):
    slots = await self.get_available_slots(date, count=50)

    # Requested time not in available slots? Find nearest.
    def distance(s):
        m = int(s["start_time"].split(":")[0]) * 60 + int(s["start_time"].split(":")[1])
        return abs(m - req_minutes)

    alternatives = sorted(slots, key=distance)[:3]
    return {"available": False, "alternatives": alternatives}
```

### 5. Multi-Round Tool Chaining (`scheduler_agent.py`)

The agent chains up to 5 rounds — a typical booking flow is:
`resolve_date` → `check_slot` → `book_appointment` in a single turn.

```python
async def generate_response(self):
    MAX_ROUNDS = 5
    for round_num in range(MAX_ROUNDS):
        response = await self.llm.chat(
            messages=self.context.messages,
            stream=True,
            tools=self.tool_schemas,
        )
        # ... stream text, collect tool calls ...
        if not tool_calls:
            return  # Final spoken response
        results = await self.tool_registry.execute(tool_calls=tool_calls, parallel=True)
        # ... add results to context, loop ...
```

---

## Cal.com API Mapping

| Agent Tool | CalcomClient Method | Cal.com Endpoint | Purpose |
|------------|-------------------|-----------------|---------|
| `resolve_date` | — (local) | — | Resolve natural language date to YYYY-MM-DD |
| `check_slot` | `check_slot()` | `GET /v2/slots/available` | Check availability + suggest alternatives |
| `get_available_slots` | `get_available_slots()` | `GET /v2/slots/available` | List N free times for a date |
| `book_appointment` | `create_booking()` | `POST /v2/bookings` | Create booking with attendee info |
| `find_appointment` | `get_bookings()` | `GET /v2/bookings` | Look up existing bookings by name/date |

---

## When to Use This

✅ **Use this example when you need to:**
- Book appointments over a phone call with real calendar integration
- Show slot negotiation ("that's taken, how about…?")
- Check and manage existing bookings by voice
- Handle natural date references in conversation
- Integrate with any calendar via API (Cal.com shown, adaptable to Google Calendar, etc.)

❌ **This is NOT the right example if you:**
- Just need a simple Q&A chatbot → see [`getting_started`](../getting_started)
- Need structured form data collection → see [`form_filler`](../form_filler)
- Need database queries + banking → see [`bank_csr`](../bank_csr)
- Need observability → see [`observability`](../observability)

---

## API Reference

| Component | Import | Purpose |
|-----------|--------|---------|
| `AtomsCrewApp` | `smallestai.atoms.crew.server` | WebSocket server + session lifecycle |
| `CrewSession` | `smallestai.atoms.crew.session` | Session management, node graph |
| `OutputCrewNode` | `smallestai.atoms.crew.nodes` | Conversational agent with TTS output |
| `OpenAIClient` | `smallestai.atoms.crew.clients.openai` | Streaming LLM client |
| `ToolRegistry` | `smallestai.atoms.crew.tools` | Tool discovery, schema generation, execution |
| `@function_tool` | `smallestai.atoms.crew.tools` | Decorator to register tools from methods |
| `SDKAgentEndCallEvent` | `smallestai.atoms.crew.events` | End call |

- Atoms SDK docs: [docs.smallest.ai](https://docs.smallest.ai)
- Cal.com API docs: [cal.com/docs/api-reference](https://cal.com/docs/api-reference/v2)

---

## Next Steps

- **Structured data collection** → [`form_filler`](../form_filler) — State machine for forms with Jotform integration
- **Complex banking agent** → [`bank_csr`](../bank_csr) — Full banking agent with SQLite + audit logging
- **Observability** → [`observability`](../observability) — Add Langfuse tracing to see every tool call
- **Call transfers** → [`call_control`](../call_control) — Transfer to a human if needed
