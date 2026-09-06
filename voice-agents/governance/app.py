"""Governed voice agent: TealTiger guardrails around a Smallest AI crew node.

Every user turn is scanned before it reaches the LLM (PII is redacted in the
conversation context) and every LLM response is scanned before it is spoken.
A per-call turn cap ends runaway sessions gracefully.

Requirements:
    pip install smallestai tealtiger

Run:
    export SMALLEST_API_KEY="your-key"
    export OPENAI_API_KEY="your-openai-key"
    python app.py
"""

import os

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.events import SDKEvent, SDKSystemUserJoinedEvent
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
Help callers with account inquiries, balance checks, and transfers.

IMPORTANT:
- Never repeat sensitive information back to the caller
- If the caller provides an SSN or card number, acknowledge receipt
  without repeating it
- For complex issues, transfer to a human agent
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

        # Buffer the full response so it can be scanned before TTS speaks it.
        response = await self.llm.chat(messages=self.context.messages, stream=True)
        full_response = ""
        async for chunk in response:
            if chunk.content:
                full_response += chunk.content

        cleaned, pii = await redact(full_response)
        if pii:
            logger.warning(f"Redacted PII from agent response: {pii}")

        if cleaned:
            self.context.add_message({"role": "assistant", "content": cleaned})
            yield cleaned

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
    def transfer_to_human(self, reason: str) -> str:
        """Transfer the call to a human agent.

        Args:
            reason: Why the caller needs a human.
        """
        return f"Transferring to human agent. Reason: {reason}"


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
    print(f"Guardrails: PII redaction on input and output, {MAX_TURNS_PER_CALL}-turn cap per call")
    app = AtomsCrewApp(setup_handler=setup_session)
    app.run()
