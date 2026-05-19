"""Form Filler Agent — voice-driven structured data collection.

Demonstrates:
- State machine driving the conversation (not free-form chat)
- Step-by-step field collection with validation
- Backtracking ("go back to personal details")
- Review and confirmation flow
- Jotform integration for native form submission
- Multi-round tool chaining for field extraction
"""

import json
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.swarm.clients.openai import OpenAIClient
from smallestai.atoms.swarm.clients.types import ToolCall, ToolResult
from smallestai.atoms.swarm.events import SDKAgentEndCallEvent
from smallestai.atoms.swarm.nodes import OutputSwarmNode
from smallestai.atoms.swarm.tools import ToolRegistry, function_tool

from form_engine import FormEngine
from jotform_client import JotformClient

load_dotenv()


# ---------------------------------------------------------------------------
# System prompt — the form engine provides step-specific instructions
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are **Nisha**, a helpful insurance claims assistant at **Smallest Insurance**.
You collect health insurance claim details over the phone.

## Your Role
Guide the caller step-by-step through their insurance claim form.
You have a form engine that tracks which fields are needed.

## How It Works
1. Start by calling `start_form` to begin the collection process
2. The engine tells you which fields to collect — each field shows its exact
   identifier in quotes (e.g. "insurer_name"). Use that EXACT identifier as
   the field_name argument to `set_field`.
3. Ask the caller for each field naturally — DON'T read out field names like a robot
4. After the caller responds, use `set_field` to store and validate each value
5. When all fields in a step are filled, call `next_step` to advance
6. At the end, call `review_form` to read back all details for confirmation
7. If confirmed, call `confirm_form` to finalize and generate the report

## Conversation Style
- Warm and efficient — like a good insurance helpdesk rep on a PHONE CALL
- Keep responses to 1–3 sentences. Be concise.
- Ask for 1–2 fields at a time, not all at once
- NEVER read out technical formats to the caller (no "YYYY-MM-DD", no regex patterns)
  Just ask naturally: "What's your date of birth?" or "What's your policy number?"
- If validation fails, explain simply and ask again WITHOUT mentioning format codes
- When the caller says "go back", use `previous_step`

## Field Extraction Rules (internal — do NOT share with caller)
- ALWAYS extract just the value, not the surrounding sentence.
  "my name is Ajay Kumar" → set_field("full_name", "Ajay Kumar")
- Dates: Convert ANY spoken date to YYYY-MM-DD before calling set_field
  "March fifteenth eighty five" → "1985-03-15"
  "7th feb summer of 69" → "1969-02-07"
- Phone: Extract just digits ("98765 43210" → "9876543210")
- Currency: Extract number only ("fifty thousand" → "50000", "₹1.5 lakh" → "150000")
- Policy number: Caller says "HLT dash 12345678", you extract "HLT-12345678".
  The engine handles case-insensitivity — just pass what they said.
- Choices: The engine fuzzy-matches ("top up" matches "Top-up", "opd" matches "OPD").
  Just pass the caller's words as-is.
- Text fields: Any non-empty string is valid — just pass the extracted text

## Important
- ALWAYS use the form tools. Never skip the engine — it validates everything.
- Read back amounts in Indian numbering: "one lakh fifty thousand rupees"
- After confirmation, tell the caller their claim has been submitted.
"""


class FormAgent(OutputSwarmNode):
    """Voice agent that fills forms via a state machine."""

    def __init__(self, form: FormEngine, jotform: Optional[JotformClient] = None):
        super().__init__(name="form-agent")

        self.form = form
        self.jotform = jotform or JotformClient()

        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            temperature=0.5,
            api_key=os.getenv("OPENAI_API_KEY"),
        )

        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({"role": "system", "content": SYSTEM_PROMPT})

    # ------------------------------------------------------------------
    # Response loop — multi-round tool chaining
    # ------------------------------------------------------------------

    async def generate_response(self):
        """Generate response with tool chaining.

        The LLM typically does:
        1. set_field (store what the caller said)
        2. set_field (maybe another field from same utterance)
        3. next_step (if step is complete)
        4. Speak the next question
        """
        MAX_ROUNDS = 8  # forms need more rounds for multi-field extraction

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

            if not tool_calls:
                if full_response:
                    self.context.add_message(
                        {"role": "assistant", "content": full_response}
                    )
                return

            results: List[ToolResult] = await self.tool_registry.execute(
                tool_calls=tool_calls, parallel=True
            )

            for tc, result in zip(tool_calls, results):
                logger.info(
                    f"[FormAgent] Tool: {tc.name} | "
                    f"Result: {str(result.content)[:120]}"
                )

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

        # Final wrap-up if max rounds hit
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
    # Form tools
    # ------------------------------------------------------------------

    @function_tool()
    def start_form(self) -> str:
        """Start the form collection process.

        Call this at the beginning to get the first step's fields.
        """
        result = self.form.start()
        return json.dumps(result, default=str)

    @function_tool()
    def set_field(self, field_name: str, value: str) -> str:
        """Set a form field value. The engine validates it.

        Call this for each piece of information the caller provides.

        Args:
            field_name: The field identifier (e.g. 'full_name', 'date_of_birth').
            value: The value to set (e.g. 'Ajay Kumar', '1985-03-15').
        """
        result = self.form.set_field(field_name, value)
        return json.dumps(result, default=str)

    @function_tool()
    def next_step(self) -> str:
        """Move to the next step of the form.

        Call this when all required fields in the current step are filled.
        Returns the next step's fields, or review if all steps are done.
        """
        result = self.form.next_step()
        return json.dumps(result, default=str)

    @function_tool()
    def previous_step(self) -> str:
        """Go back to the previous step.

        Use when the caller wants to correct something in a previous section.
        """
        result = self.form.previous_step()
        return json.dumps(result, default=str)

    @function_tool()
    def get_progress(self) -> str:
        """Check current form progress — which step, how many fields filled."""
        return json.dumps(self.form.progress, default=str)

    @function_tool()
    def review_form(self) -> str:
        """Get all collected data for the caller to review.

        Call this after all steps are complete. Read back the key details
        to the caller and ask for confirmation.
        """
        result = self.form.get_review()
        return json.dumps(result, default=str)

    @function_tool()
    async def confirm_form(self) -> str:
        """Confirm and finalize the form after the caller approves.

        Submits the form data to Jotform (if configured) so it appears
        as a native submission in the Jotform dashboard.
        Only call after the caller explicitly confirms.
        """
        result = self.form.confirm()

        # --- Jotform: submit as a native form entry ---
        if self.jotform.enabled:
            # Build label map: field_name → label for Jotform matching
            field_labels = {}
            for step in self.form.steps:
                for f in step.fields:
                    field_labels[f.name] = f.label

            jotform_result = await self.jotform.submit(
                form_data=self.form.data,
                field_labels=field_labels,
            )
            result["jotform"] = jotform_result
            logger.success(f"[FormAgent] Jotform: {jotform_result.get('status')}")
        else:
            logger.info("[FormAgent] Jotform not configured — skipping submission")

        # --- Local HTML report (useful for dev / fallback) ---
        try:
            report_path = self.form.generate_html_report()
            result["report_path"] = report_path
        except Exception:
            result["report_path"] = None

        result["json_data"] = self.form.to_json()

        logger.success("[FormAgent] Form confirmed!")
        return json.dumps(result, default=str)

    @function_tool()
    async def end_call(self) -> None:
        """End the call when the form is complete and caller is done."""
        await self.send_event(SDKAgentEndCallEvent())
        return None
