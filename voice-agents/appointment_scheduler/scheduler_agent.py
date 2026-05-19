"""Appointment Scheduler — voice agent with Cal.com calendar.

Demonstrates:
- Real availability checking against a live Cal.com calendar
- Slot negotiation ("5pm is busy, how about 7:30pm?")
- Booking confirmations with details read back
- Natural date resolution ("Tuesday" → 2026-02-17)
"""

import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List

import dateparser
from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.clients.types import ToolCall, ToolResult
from smallestai.atoms.crew.events import SDKAgentEndCallEvent
from smallestai.atoms.crew.nodes import OutputCrewNode
from smallestai.atoms.crew.tools import ToolRegistry, function_tool

from calcom_client import CalcomClient

load_dotenv()

# ---------------------------------------------------------------------------
# Helpers — date resolution
# ---------------------------------------------------------------------------

WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
}


def resolve_date_reference(ref: str) -> str:
    """Resolve any date reference to YYYY-MM-DD.

    Handles:
    - Relative:  'today', 'tomorrow', 'monday'–'sunday', 'next tuesday'
    - Partial:   '12 feb', 'feb 13', 'march 4th', '4th march'
    - Absolute:  '2026-02-13' (passed through)

    Uses dateparser as fallback for partial dates, with PREFER_DATES_FROM
    set to 'future' so "12 feb" resolves to the next upcoming Feb 12.
    """
    ref_lower = ref.strip().lower()
    today = datetime.now().date()

    # Already YYYY-MM-DD
    if len(ref_lower) == 10 and ref_lower[4] == "-" and ref_lower[7] == "-":
        return ref_lower

    if ref_lower == "today":
        return today.strftime("%Y-%m-%d")
    if ref_lower == "tomorrow":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # Handle "next <weekday>" or just "<weekday>"
    clean = ref_lower.replace("next ", "")
    if clean in WEEKDAYS:
        target_day = WEEKDAYS[clean]
        days_ahead = target_day - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # Fallback: use dateparser for partial dates like "12 feb", "march 4th"
    # Use "current_period" so "12 feb" on Feb 12 = today, not next year
    parsed = dateparser.parse(
        ref,
        settings={
            "PREFER_DATES_FROM": "current_period",
            "RELATIVE_BASE": datetime.now(),
        },
    )
    if parsed:
        result_date = parsed.date()
        # If the resolved date is in the past, bump to next year
        if result_date < today:
            result_date = result_date.replace(year=result_date.year + 1)
        return result_date.strftime("%Y-%m-%d")

    # Last resort — return today's date with a warning
    logger.warning(f"[resolve_date] Could not parse '{ref}', defaulting to today")
    return today.strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

def build_system_prompt() -> str:
    """Build system prompt with today's date injected."""
    today = datetime.now()
    today_str = today.strftime("%A, %B %d, %Y")  # e.g. "Thursday, February 12, 2026"

    return f"""You are **Ria**, a friendly and efficient receptionist at **Smallest Health Clinic**.

Today is **{today_str}**.

## Your Role
Help patients book, check, and manage appointments with the doctor.
You have access to a live Cal.com calendar — never invent availability.

## Voice & Style
- Warm and professional — like a good clinic receptionist
- Keep responses short: 1–3 sentences. This is a phone call.
- Always confirm key details before booking: date, time, patient name

## How Appointment Booking Works
1. Ask what the patient needs and their preferred date/time
2. **ALWAYS** use `resolve_date` for ANY date the patient mentions — including "12 feb", "march 4th", "tomorrow", "tuesday", etc. NEVER construct a YYYY-MM-DD date yourself.
3. Use `check_slot` to verify availability — ALWAYS check, never guess
4. If the slot is busy, tell them and suggest the alternatives returned by the tool
5. Once they pick a slot, ask for their name and use `book_appointment` to confirm
6. Read back the confirmed date and time

## Checking Existing Appointments
When a patient says they want to **check**, **confirm**, or **look up** an existing appointment:
1. Use `resolve_date` to get the date they mention
2. Ask for their name if they haven't provided it
3. Use `find_appointment` with the date and/or name to search Cal.com
4. If found, read back the appointment details (date, time)
5. If not found, let them know and offer to book a new one

## Important Rules
- **ALWAYS call `resolve_date` first** before calling `check_slot`, `get_available_slots`, or `find_appointment`. Never write a date like "2026-02-13" yourself — let the tool do it.
- NEVER invent availability. Always call `check_slot` or `get_available_slots`.
- When a patient asks to check/confirm an existing appointment, ALWAYS use `find_appointment` — do NOT use `get_available_slots` for this.
- If a slot is busy, ALWAYS mention the alternatives from the tool response.
  Say something like "5 pm is taken, but I have openings at 3:30, 6:00, and 7:30 — which works for you?"
- Read times in 12-hour format: "3:30 PM", "7:30 PM" (not "15:30", "19:30")
- After booking, read back: "All set! Tuesday February 17th at 7:30 PM."
"""


class SchedulerAgent(OutputCrewNode):
    """Appointment scheduling agent with Cal.com calendar."""

    def __init__(self, calcom: CalcomClient):
        super().__init__(name="scheduler-agent")

        self.calcom = calcom

        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            temperature=0.6,
            api_key=os.getenv("OPENAI_API_KEY"),
        )

        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({"role": "system", "content": build_system_prompt()})

    # ------------------------------------------------------------------
    # Response loop — multi-round tool chaining
    # ------------------------------------------------------------------

    async def generate_response(self):
        """Generate response with tool chaining support.

        The LLM can call multiple tools in sequence:
        1. resolve_date → get actual date
        2. check_slot → verify availability
        3. book_appointment → confirm booking

        Each tool result feeds back into the LLM for the next decision.
        """
        MAX_ROUNDS = 5

        for round_num in range(MAX_ROUNDS):
            response = await self.llm.chat(
                messages=self.context.messages,
                stream=True,
                tools=self.tool_schemas,
            )

            tool_calls: List[ToolCall] = []
            full_response = ""

            async for chunk in response:
                if chunk.content:
                    full_response += chunk.content
                    yield chunk.content
                if chunk.tool_calls:
                    tool_calls.extend(chunk.tool_calls)

            # If no tool calls, we're done
            if not tool_calls:
                if full_response:
                    self.context.add_message(
                        {"role": "assistant", "content": full_response}
                    )
                return

            # Execute tool calls
            results: List[ToolResult] = await self.tool_registry.execute(
                tool_calls=tool_calls, parallel=True
            )

            # Log tool calls
            for tc, result in zip(tool_calls, results):
                logger.info(
                    f"[SchedulerAgent] Tool: {tc.name} | "
                    f"Result: {str(result.content)[:100]}"
                )

            # Add tool calls + results to context
            self.context.add_messages([
                {
                    "role": "assistant",
                    "content": full_response or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": (
                                    json.dumps(tc.arguments) if isinstance(tc.arguments, dict)
                                    else str(tc.arguments)
                                ),
                            },
                        }
                        for tc in tool_calls
                    ],
                },
                *[
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": "" if result.content is None else str(result.content),
                    }
                    for tc, result in zip(tool_calls, results)
                ],
            ])

            # Continue loop — LLM will see tool results and decide next step

        # If we hit max rounds, let LLM wrap up
        final = await self.llm.chat(
            messages=self.context.messages, stream=True
        )
        final_text = ""
        async for chunk in final:
            if chunk.content:
                final_text += chunk.content
                yield chunk.content
        if final_text:
            self.context.add_message({"role": "assistant", "content": final_text})

    # ------------------------------------------------------------------
    # Tools
    # ------------------------------------------------------------------

    @function_tool()
    def resolve_date(self, date_reference: str) -> str:
        """Resolve a relative date reference to an actual date (YYYY-MM-DD).

        Use this when the patient says 'today', 'tomorrow', 'Tuesday',
        'next Wednesday', etc.

        Args:
            date_reference: The date reference to resolve (e.g. 'tuesday', 'tomorrow').
        """
        resolved = resolve_date_reference(date_reference)
        date_obj = datetime.strptime(resolved, "%Y-%m-%d")
        day_name = date_obj.strftime("%A, %B %d")
        return json.dumps({"date": resolved, "display": day_name})

    @function_tool()
    async def check_slot(self, date: str, time: str) -> str:
        """Check if a specific time slot is available.

        Returns availability status. If busy, includes alternative slots
        near the requested time.

        Args:
            date: Date in YYYY-MM-DD format.
            time: Time in HH:MM 24-hour format (e.g. '17:00' for 5pm).
        """
        result = await self.calcom.check_slot(date, time)
        return json.dumps(result, default=str)

    @function_tool()
    async def get_available_slots(self, date: str, count: int = 5) -> str:
        """Get a list of available appointment slots for a date.

        Args:
            date: Date in YYYY-MM-DD format.
            count: How many slots to return (default 5).
        """
        result = await self.calcom.get_available_slots(date, count)
        return json.dumps(result, default=str)

    @function_tool()
    async def book_appointment(
        self,
        patient_name: str,
        date: str,
        time: str,
        reason: str = "",
    ) -> str:
        """Book an appointment after confirming with the patient.

        ONLY call this after:
        1. Checking availability with check_slot
        2. Confirming the time with the patient

        Args:
            patient_name: Full name of the patient.
            date: Date in YYYY-MM-DD format.
            time: Time in HH:MM 24-hour format.
            reason: Reason for the appointment.
        """
        result = await self.calcom.create_booking(
            date=date,
            time=time,
            attendee_name=patient_name,
            reason=reason,
        )
        return json.dumps(result, default=str)

    @function_tool()
    async def find_appointment(
        self, date: str = "", patient_name: str = ""
    ) -> str:
        """Look up existing appointments on Cal.com.

        Use this when a patient wants to check, confirm, or cancel an
        existing appointment. You can search by date, patient name, or both.

        Args:
            date: Date in YYYY-MM-DD format (optional).
            patient_name: Patient name to search for (optional, case-insensitive).
        """
        result = await self.calcom.get_bookings(
            date=date, attendee_name=patient_name
        )
        return json.dumps(result, default=str)

    @function_tool()
    async def end_call(self) -> None:
        """End the call when the patient says goodbye or is done."""
        await self.send_event(SDKAgentEndCallEvent())
        return None
