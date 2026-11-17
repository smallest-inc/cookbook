"""Governed voice agent: TealTiger guardrails around a Smallest AI crew node.

Every user turn is scanned before it reaches the LLM (PII is redacted in the
conversation context), tool results are scanned before they go back to the
LLM, and every LLM response is scanned before it is spoken. The LLM can call
three tools (lookup_account, check_balance, transfer_to_human). A per-call
turn cap and a per-turn tool-round cap end runaway sessions gracefully.

Requirements:
    pip install smallestai tealtiger

Run:
    export SMALLEST_API_KEY="your-key"
    export OPENAI_API_KEY="your-openai-key"
    export TRANSFER_NUMBER="+15550100"   # optional: human line for transfers
    python app.py
"""

import json
import os
from typing import List

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.clients.types import ToolCall, ToolResult
from smallestai.atoms.crew.events import (
    SDKAgentTransferConversationEvent,
    SDKEvent,
    SDKSystemUserJoinedEvent,
    TransferOption,
    TransferOptionType,
)
from smallestai.atoms.crew.nodes import OutputCrewNode
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession
from smallestai.atoms.crew.tools import ToolRegistry, function_tool
from tealtiger import GuardrailEngine, PIIDetectionGuardrail

load_dotenv()

# ─────────────────────────────────────────────────────────────────
# Step 1: Configure TealTiger guardrails
# ─────────────────────────────────────────────────────────────────

# One engine scans both directions: caller speech before the LLM sees it,
# and the LLM's reply before TTS speaks it.
guardrails = GuardrailEngine()
guardrails.register_guardrail(PIIDetectionGuardrail())

MAX_TURNS_PER_CALL = 20  # runaway-loop cap
MAX_TOOL_ROUNDS = 3  # tool calls the LLM may chain within one turn

# Optional human line for transfer_to_human. Without it the agent says a person
# will follow up instead of promising a live transfer.
TRANSFER_NUMBER = os.getenv("TRANSFER_NUMBER", "").strip()


async def redact(text: str) -> tuple[str, list[str]]:
    """Scan text with the guardrail engine; return (redacted_text, pii_types)."""
    result = await guardrails.execute(text)
    if result.passed:
        return text, []

    found: list[str] = []
    for entry in result.results:
        for detection in entry["result"].get("metadata", {}).get("detections", []):
            found.append(detection["type"])
            text = text.replace(detection["value"], f"[{detection['type'].upper()} REDACTED]")
    return text, found


# ─────────────────────────────────────────────────────────────────
# Step 2: The governed agent node
# ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a customer support agent for Acme Corp.
Help callers with account lookups and balance checks.

Tools:
- lookup_account and check_balance take the caller's account ID.
- transfer_to_human hands the caller to a person. Use it for complex issues
  or when the caller asks for a human.

IMPORTANT:
- Never repeat sensitive information back to the caller
- If the caller provides an SSN or card number, acknowledge receipt
  without repeating it
- Keep replies short; they are spoken aloud
"""


class GovernedSupportAgent(OutputCrewNode):
    """Voice agent with guardrails at every turn."""

    def __init__(self):
        super().__init__(name="governed-support-agent")
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        self.turns = 0

        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({"role": "system", "content": SYSTEM_PROMPT})

    async def generate_response(self):
        """One governed turn: redact input, cap turns, scan output."""
        self.turns += 1
        if self.turns > MAX_TURNS_PER_CALL:
            yield (
                "I apologize, but I need to end this call. "
                "Please call back or visit our website for further assistance."
            )
            return

        # Redact PII in the caller's last message BEFORE the LLM sees it.
        for message in reversed(self.context.messages):
            if message["role"] == "user":
                cleaned, pii = await redact(message["content"])
                if pii:
                    logger.warning(f"Redacted PII from caller turn: {pii}")
                    message["content"] = cleaned
                break

        # Let the LLM call tools, then buffer the final reply so it can be
        # scanned before TTS speaks it. Nothing is yielded until the scan.
        full_response = ""
        for _ in range(MAX_TOOL_ROUNDS + 1):
            response = await self.llm.chat(
                messages=self.context.messages,
                stream=True,
                tools=self.tool_schemas,
            )
            text = ""
            tool_calls: List[ToolCall] = []
            async for chunk in response:
                if chunk.content:
                    text += chunk.content
                if chunk.tool_calls:
                    tool_calls.extend(chunk.tool_calls)

            if not tool_calls:
                full_response = text
                break

            logger.info(f"Tool calls: {[tc.name for tc in tool_calls]}")
            results: List[ToolResult] = await self.tool_registry.execute(
                tool_calls=tool_calls, parallel=True
            )
            await self._add_tool_turn(tool_calls, results)
        else:
            full_response = (
                "Sorry, I couldn't finish that request. "
                "Let me get a person to help you."
            )

        cleaned, pii = await redact(full_response)
        if pii:
            logger.warning(f"Redacted PII from agent response: {pii}")

        if cleaned:
            self.context.add_message({"role": "assistant", "content": cleaned})
            yield cleaned

    async def _add_tool_turn(self, tool_calls: List[ToolCall], results: List[ToolResult]):
        """Record the tool calls and their (redacted) results in the context."""
        tool_messages = []
        for tc, result in zip(tool_calls, results):
            content = "" if result.content is None else str(result.content)
            content, pii = await redact(content)
            if pii:
                logger.warning(f"Redacted PII from {tc.name} result: {pii}")
            tool_messages.append({"role": "tool", "tool_call_id": tc.id, "content": content})

        self.context.add_messages([
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": tc.arguments
                            if isinstance(tc.arguments, str)
                            else json.dumps(tc.arguments),
                        },
                    }
                    for tc in tool_calls
                ],
            },
            *tool_messages,
        ])

    @function_tool()
    def lookup_account(self, account_id: str) -> str:
        """Look up a customer account by ID.

        Args:
            account_id: The account identifier.
        """
        return f"Account {account_id}: Premium tier, active since 2024"

    @function_tool()
    def check_balance(self, account_id: str) -> str:
        """Check account balance.

        Args:
            account_id: The account identifier.
        """
        return f"Account {account_id} balance: $1,234.56"

    @function_tool()
    async def transfer_to_human(self, reason: str) -> str:
        """Transfer the call to a human agent.

        Args:
            reason: Why the caller needs a human.
        """
        logger.info(f"Transfer requested: {reason}")
        if not TRANSFER_NUMBER:
            return (
                "No human line is configured for this demo. Tell the caller a "
                "person will follow up, and do not promise a live transfer."
            )
        await self.speak("Sure, I'll connect you to a person now. Please hold.")
        await self.send_event(
            SDKAgentTransferConversationEvent(
                transfer_call_number=TRANSFER_NUMBER,
                transfer_options=TransferOption(type=TransferOptionType.COLD_TRANSFER),
                on_hold_music="relaxing_sound",
            )
        )
        return "Transfer started. Do not say anything else."


# ─────────────────────────────────────────────────────────────────
# Step 3: Run the voice agent
# ─────────────────────────────────────────────────────────────────


async def setup_session(session: CrewSession):
    agent = GovernedSupportAgent()
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = "Hello! You've reached Acme Corp support. How can I help you today?"
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    print("Starting governed voice agent...")
    print(
        f"Guardrails: PII redaction on caller input, tool results and agent output; "
        f"{MAX_TURNS_PER_CALL}-turn cap per call; {MAX_TOOL_ROUNDS} tool rounds per turn"
    )
    app = AtomsCrewApp(setup_handler=setup_session)
    app.run()
