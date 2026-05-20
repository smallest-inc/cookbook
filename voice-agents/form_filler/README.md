# 📋 Form Filler — Voice-Driven Structured Data Collection

A **state machine** drives the conversation — step-by-step field collection with typed validation, backtracking, review, and native [Jotform](https://www.jotform.com) submission so completed forms appear in a real dashboard.

> **The key pattern:** The LLM handles conversation, the `FormEngine` handles structure. The agent follows a deterministic state machine — it can't skip steps, can't accept invalid data, and always collects everything needed. Completed forms are submitted to Jotform as native entries.

---

## Example Interaction

```
Nisha: Hello! I'm Nisha from Smallest Insurance claims desk.
       I'll help you file your health insurance claim.
       It'll take about 3-4 minutes. Shall we get started?

You:   Yes, let's go.

       ┌── start_form() ──────────────────────────────────────────┐
       │ Step 1/4: Personal Details                                │
       │ Fields: Full Name, Date of Birth, Phone, Email (optional) │
       └──────────────────────────────────────────────────────────-─┘

Nisha: Great! Let's start with your personal details.
       What's your full name as it appears on your insurance policy?

You:   Ajay Kumar.

       ┌── set_field("full_name", "Ajay Kumar") → ✓ valid ────────┐
       └───────────────────────────────────────────────────────────-─┘

Nisha: Got it, Ajay. And your date of birth?

You:   March 15, 1985.

       ┌── set_field("date_of_birth", "1985-03-15") → ✓ valid ────┐
       └───────────────────────────────────────────────────────────-─┘

Nisha: Thanks. And your mobile number?

You:   98765 43210.

       ┌── set_field("phone", "9876543210") → ✓ normalized ───────┐
       │── next_step() → Step 2/4: Policy Details                   │
       └───────────────────────────────────────────────────────────-─┘

Nisha: Perfect. Now let's get your policy details.
       What's your policy number?

You:   hlt dash 1-2-3-4-5-6-7-8.

       ┌── set_field("policy_number", "hlt-12345678") ─────────────┐
       │ Engine: case-insensitive match → stored as "HLT-12345678"  │
       └───────────────────────────────────────────────────────────-─┘

Nisha: Got it. And which insurance company?

You:   Star Health.

Nisha: What type of plan is it?

You:   family floater.

       ┌── set_field("plan_type", "family floater") ───────────────┐
       │ Engine: fuzzy match → stored as "Family Floater"           │
       └───────────────────────────────────────────────────────────-─┘

       ... (continues through Treatment Details and Claim Amount) ...

       ┌── review_form() ─────────────────────────────────────────-─┐
       │ Personal: Ajay Kumar, DOB 1985-03-15, Ph 9876543210        │
       │ Policy: HLT-12345678, Star Health, Family Floater          │
       │ Treatment: Apollo Hospital, Dengue fever, Jan 10-15         │
       │ Claim: ₹2,50,000 bill, ₹2,00,000 claimed, A/c ending 4321 │
       └───────────────────────────────────────────────────────────-─┘

Nisha: Let me read back your details. Ajay Kumar, policy HLT-1-2-3-4-5-6-7-8
       with Star Health, Family Floater plan. Hospitalized at Apollo for dengue
       fever, January 10th to 15th. Claiming 2 lakh rupees against a 2.5 lakh
       bill. Is that correct?

You:   Yes, that's right.

       ┌── confirm_form() ─────────────────────────────────────────┐
       │ → Jotform: submitted! ID: 6020234567890 (12 fields matched)│
       │ → HTML report: health_insurance_claim_20260210.html         │
       └───────────────────────────────────────────────────────────-─┘

Nisha: Your claim has been submitted! You can track it on our portal.
       Is there anything else I can help with?
```

---

## Features

| Feature | Description |
|---------|-------------|
| **State machine** | Deterministic step progression — can't skip, can't submit incomplete |
| **Typed fields** | text, number, date, phone, email, choice, currency |
| **Voice-friendly validation** | Fuzzy choice matching, case-insensitive regex, phone normalization |
| **Jotform integration** | Completed forms submitted as native Jotform entries (visible in dashboard) |
| **Backtracking** | "Go back" returns to previous step with data preserved |
| **Review + confirm** | All data read back before submission |
| **HTML report** | Local report generated on confirmation (useful for dev) |
| **JSON export** | Full form data exported as JSON |
| **Multi-round chaining** | LLM extracts multiple fields per utterance |

---

## Voice-Friendly Validation

This is a **phone call**, not a web form. The engine handles the messy reality of voice transcription:

| What the caller says | What ASR gives us | What gets stored |
|---------------------|-------------------|-----------------|
| "top up" | `"top up"` | `"Top-up"` — fuzzy choice match |
| "opd" | `"opd"` | `"OPD"` — fuzzy choice match |
| "family floater" | `"family floater"` | `"Family Floater"` — canonical form |
| "hlt dash 33333333" | `"hlt-33333333"` | `"HLT-33333333"` — case-insensitive regex |
| "98765 43210" | `"98765 43210"` | `"9876543210"` — digit extraction |
| "March fifteenth eighty five" | LLM converts → `"1985-03-15"` | `"1985-03-15"` |

The agent **never** reads out format codes to the caller — no "YYYY-MM-DD", no regex patterns. It just asks naturally: "What's your date of birth?"

---

## Form: Health Insurance Claim

| Step | Fields |
|------|--------|
| **1. Personal Details** | Full Name, Date of Birth, Phone, Email (optional) |
| **2. Policy Details** | Policy Number, Insurance Company, Plan Type |
| **3. Treatment Details** | Hospital, Admission Date, Discharge Date, Diagnosis, Treatment Type |
| **4. Claim Amount** | Total Bill (₹), Claim Amount (₹), Bank Account last 4 |

**Plan Type choices:** Individual, Family Floater, Group, Top-up
**Treatment Type choices:** Hospitalization, Day Care, OPD, Maternity

---

## Requirements

- Python ≥ 3.12
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Smallest AI API key](https://app.smallest.ai)
- A [Jotform account](https://www.jotform.com) (free tier — optional but recommended)

### Dependencies

```
smallestai >= 4.3.0
httpx
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

# Jotform (optional — without these, only local HTML reports are generated)
export JOTFORM_API_KEY=...
export JOTFORM_FORM_ID=...
```

Or create a `.env` file:

```env
OPENAI_API_KEY=sk-...
SMALLEST_API_KEY=...
JOTFORM_API_KEY=...
JOTFORM_FORM_ID=...
```

### 3. Run

```bash
uv run app.py
```

### 4. Test

```bash
smallestai agent-crew chat
```

Walk through the insurance claim form — the agent guides you step by step.

### 5. Deploy

```bash
smallestai agent-crew deploy --entry app.py
```

---

## Setting Up Jotform

The agent submits completed forms as **native Jotform submissions** — they show up in the Jotform dashboard with all fields filled, just like a human filled them out.

### Step 1: Create a Jotform form

1. Go to [jotform.com](https://www.jotform.com) → **Create Form**
2. Add fields that match the insurance claim form labels:

| Jotform Field Label | Jotform Field Type | Maps to |
|--------|-----------|---------|
| Full Name | Short Text / Full Name | `full_name` |
| Date of Birth | Date Picker | `date_of_birth` |
| Phone Number | Phone Number | `phone` |
| Email Address | Email | `email` |
| Policy Number | Short Text | `policy_number` |
| Insurance Company | Short Text | `insurer_name` |
| Plan Type | Dropdown / Single Choice | `plan_type` |
| Hospital Name | Short Text | `hospital_name` |
| Date of Admission | Date Picker | `admission_date` |
| Date of Discharge | Date Picker | `discharge_date` |
| Diagnosis / Condition | Short Text | `diagnosis` |
| Treatment Type | Dropdown / Single Choice | `treatment_type` |
| Total Hospital Bill (₹) | Number | `total_bill_amount` |
| Claim Amount (₹) | Number | `claim_amount` |
| Bank Account (last 4 digits) | Short Text | `bank_account_last4` |

> **Matching is by label.** The `JotformClient` fetches your Jotform's question labels and matches them to the `FormEngine` field labels. Exact label match (case-insensitive) is required. Fields that don't match are logged as warnings and skipped.

### Step 2: Get your API key

1. Go to [jotform.com/myaccount/api](https://www.jotform.com/myaccount/api)
2. Click **Create New Key** → Full Access
3. Copy the API key → set as `JOTFORM_API_KEY`

### Step 3: Get your form ID

Your form URL looks like `https://form.jotform.com/251234567890` — the number at the end (`251234567890`) is your form ID. Set it as `JOTFORM_FORM_ID`.

### Step 4: Run and verify

```bash
export JOTFORM_API_KEY=your-api-key
export JOTFORM_FORM_ID=your-form-id
uv run app.py
```

After completing a form over the phone, check your Jotform dashboard — the submission will appear as a native entry with all fields populated.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          CrewSession                             │
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │  FormEngine            │     │  FormAgent                    │  │
│  │  (State Machine)       │◄────│  OutputCrewNode               │  │
│  │                        │     │                              │  │
│  │  State:                │     │  Tools:                      │  │
│  │  NOT_STARTED           │     │  • start_form                │  │
│  │  → COLLECTING          │     │  • set_field                 │  │
│  │  → REVIEWING           │     │  • next_step                 │  │
│  │  → CONFIRMED           │     │  • previous_step             │  │
│  │                        │     │  • get_progress              │  │
│  │  Validates:            │     │  • review_form               │  │
│  │  • types + patterns    │     │  • confirm_form              │  │
│  │  • required fields     │     │  • end_call                  │  │
│  │  • step completeness   │     │                              │  │
│  │  • voice normalization │     │  LLM:                        │  │
│  │                        │     │  • Extracts fields from      │  │
│  │  Generates:            │     │    natural speech            │  │
│  │  • HTML report         │     │  • Handles conversation      │  │
│  └────────────────────────┘     └──────────────────────────────┘  │
│                                        │                         │
│                                        ▼                         │
│                              ┌──────────────────┐                │
│                              │  JotformClient    │                │
│                              │  (httpx → API)    │                │
│                              │                   │                │
│                              │  • Auto-discover  │                │
│                              │    question IDs   │                │
│                              │  • Submit as      │                │
│                              │    native entry   │                │
│                              └──────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Lines | Description |
|------|-------|-------------|
| `app.py` | ~76 | Entry point — creates form + Jotform client + agent |
| `form_engine.py` | ~567 | State machine, field types, voice-friendly validation, HTML generation |
| `form_agent.py` | ~299 | OutputCrewNode with form tools + multi-round chaining |
| `jotform_client.py` | ~166 | Auto-discovers Jotform question IDs, submits native entries |
| `requirements.txt` | ~2 | Dependencies |

---

## State Machine Flow

```
                    start_form()
                         │
                         ▼
              ┌─────────────────────┐
              │    COLLECTING        │◄──── previous_step()
              │    Step 1 → 2 → 3 → 4│────► next_step()
              └──────────┬──────────┘
                         │ all steps done
                         ▼
              ┌─────────────────────┐
              │    REVIEWING         │
              │    review_form()     │
              └──────────┬──────────┘
                         │ caller confirms
                         ▼
              ┌─────────────────────┐
              │    CONFIRMED         │
              │    confirm_form()    │──── Jotform submission + HTML report
              └─────────────────────┘
```

---

## How It Works

### 1. Session Setup (`app.py`)

The form engine and Jotform client are created per session:

```python
form = create_insurance_claim_form()

jotform = JotformClient()          # reads env vars automatically
if jotform.enabled:
    await jotform.discover_questions()  # fetches Jotform question IDs once

agent = FormAgent(form=form, jotform=jotform)
session.add_node(agent)
await session.start()
```

### 2. Voice-Friendly Validation (`form_engine.py`)

The engine normalizes voice transcription quirks before validating:

```python
def validate(self, value: str) -> tuple[bool, str, str]:
    """Returns (is_valid, error, normalized_value)."""

    # Choices: fuzzy match ("top up" → "Top-up", "opd" → "OPD")
    if self.choices:
        def _norm(s): return re.sub(r"[\s\-_]+", "", s).lower()
        for c in self.choices:
            if _norm(c) == _norm(value):
                return True, "", c  # canonical form

    # Regex: case-insensitive ("hlt-333" → "HLT-333")
    if self.pattern:
        if not self.pattern.match(value) and self.pattern.match(value.upper()):
            return True, "", value.upper()

    # Phone: extract digits ("98765 43210" → "9876543210")
    if self.field_type == FieldType.PHONE:
        value = re.sub(r"[^\d]", "", value)
```

### 3. Jotform Auto-Discovery (`jotform_client.py`)

The client auto-discovers Jotform's numeric question IDs by matching labels:

```python
async def discover_questions(self) -> Dict[str, str]:
    """Fetch form questions → build {label: question_id} map."""
    resp = await client.get(f"/form/{self.form_id}/questions")
    for qid, q in resp.json()["content"].items():
        self._question_map[q["text"].lower()] = qid

async def submit(self, form_data, field_labels):
    """Map field values to question IDs and POST."""
    for field_name, value in form_data.items():
        label = field_labels[field_name]
        qid = self._question_map[label.lower()]
        submission[f"submission[{qid}]"] = str(value)

    await client.post(f"/form/{self.form_id}/submissions", data=submission)
```

### 4. Multi-Round Tool Chaining (`form_agent.py`)

The agent uses up to 8 rounds per turn — forms often need `set_field` + `set_field` + `next_step` in a single response:

```python
async def generate_response(self):
    MAX_ROUNDS = 8
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

## Creating Custom Forms

The `FormEngine` is generic — swap the form definition for any use case:

```python
from form_engine import FormEngine, FormStep, FormField, FieldType

loan_form = FormEngine(
    form_name="Loan Application",
    steps=[
        FormStep("personal", "Personal Info", "Collect applicant details.", [
            FormField("name", "Full Name", FieldType.TEXT),
            FormField("income", "Annual Income (₹)", FieldType.CURRENCY,
                     min_val=100000, max_val=10_00_00_000),
            FormField("employment", "Employment Type", FieldType.CHOICE,
                     choices=["Salaried", "Self-employed", "Business"]),
        ]),
        # ... more steps
    ],
)
```

Then create a matching Jotform form with the same labels, and the `JotformClient` will auto-discover and submit.

---

## When to Use This

✅ **Use this example when you need to:**
- Collect structured data over a phone call with validation
- Follow a deterministic step-by-step flow (not free-form chat)
- Submit voice-collected data to a real form platform (Jotform)
- Handle messy voice transcription (fuzzy matching, case normalization)
- Generate professional reports from voice conversations

❌ **This is NOT the right example if you:**
- Just need a simple Q&A chatbot → see [`getting_started`](../getting_started)
- Need database queries → see [`bank_csr`](../bank_csr)
- Need appointment booking → see [`appointment_scheduler`](../appointment_scheduler)
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
- Jotform API docs: [api.jotform.com/docs](https://api.jotform.com/docs/)

---

## Next Steps

- **Appointment booking** → [`appointment_scheduler`](../appointment_scheduler) — Real calendar with slot negotiation
- **Complex agent** → [`bank_csr`](../bank_csr) — Full banking agent with SQLite + audit logging
- **Observability** → [`observability`](../observability) — Add Langfuse tracing to see every field extraction
- **Call transfers** → [`call_control`](../call_control) — Transfer to a human if needed