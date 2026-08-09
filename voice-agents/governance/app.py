"""
Governed Voice Agent: PII Redaction & Cost Caps for Voice AI
============================================================

This example demonstrates how to add governance to a Smallest AI voice agent:
1. PII detection in transcribed speech (before it reaches the LLM)
2. Cost budget enforcement per call session
3. Tool authorization for voice-triggered actions
4. Structured audit trail for voice compliance (HIPAA, PCI-DSS)

The scenario: A customer support voice agent handles calls where callers
speak sensitive data (SSNs, credit card numbers, account numbers). Without
governance, this PII flows through the STT → LLM → TTS pipeline unscanned.

Requirements:
    pip install smallestai tealtiger

Run:
    export SMALLEST_API_KEY="your-key"
    python app.py
"""

from smallestai.agentic import (
    AtomsCrewApp,
    OutputCrewNode,
    function_tool,
    ToolRegistry,
)
from tealtiger import observe, TealEngine, PolicyMode


# ─────────────────────────────────────────────────────────────────
# Step 1: Configure TealTiger governance for voice
# ─────────────────────────────────────────────────────────────────

engine = TealEngine(
    policies=[
        # PII Detection: Scan transcribed speech for sensitive data
        {
            "type": "pii",
            "action": "REDACT",
            "patterns": ["ssn", "credit_card", "phone", "email", "account_number"],
            # PII is redacted BEFORE it reaches the LLM
        },

        # Cost Governance: Cap per-call spend (voice = STT + LLM + TTS per turn)
        {
            "type": "cost_limit",
            "max_per_session": 2.00,  # $2 max per call
            "action": "BLOCK",
        },

        # Tool Authorization: Only allow safe tools for voice agents
        {
            "type": "tool_allowlist",
            "tools": ["lookup_account", "check_balance", "transfer_to_human"],
        },

        # Rate Limiting: Prevent runaway agent loops
        {
            "type": "rate_limit",
            "max_calls": 20,
            "window": "5m",
        },
    ],
    mode=PolicyMode.ENFORCE,
)


# ─────────────────────────────────────────────────────────────────
# Step 2: Define voice agent tools (with governance)
# ─────────────────────────────────────────────────────────────────

tool_registry = ToolRegistry()


@function_tool(tool_registry)
def lookup_account(account_id: str) -> str:
    """Look up a customer account by ID."""
    # In production, this queries your database
    return f"Account {account_id}: Premium tier, active since 2024"


@function_tool(tool_registry)
def check_balance(account_id: str) -> str:
    """Check account balance."""
    return f"Account {account_id} balance: $1,234.56"


@function_tool(tool_registry)
def transfer_to_human(reason: str) -> str:
    """Transfer the call to a human agent."""
    return f"Transferring to human agent. Reason: {reason}"


# ─────────────────────────────────────────────────────────────────
# Step 3: Create the governed voice agent
# ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a customer support agent for Acme Corp.
Help callers with account inquiries, balance checks, and transfers.

IMPORTANT:
- Never repeat sensitive information back to the caller
- If the caller provides their SSN or card number, acknowledge receipt
  without repeating it
- For complex issues, transfer to a human agent
"""


class GovernedSupportAgent(OutputCrewNode):
    """Voice agent with TealTiger governance at every turn."""

    async def generate_response(self, transcript: str) -> str:
        """Process caller speech with governance."""

        # Governance evaluates the transcript BEFORE it reaches the LLM
        # If PII is detected, it's redacted in the transcript
        # If cost budget is exceeded, the call is ended gracefully

        decision = engine.evaluate(
            content=transcript,
            context={
                "stage": "input",
                "call_id": self.call_context.get("call_id", "unknown"),
            },
        )

        if decision.action == "BLOCK":
            # Budget exceeded or policy violation
            return (
                "I apologize, but I need to end this call. "
                "Please call back or visit our website for further assistance."
            )

        if decision.action == "REDACT":
            # PII was detected and redacted — use cleaned transcript
            transcript = decision.redacted_content

        # Now the LLM only sees redacted content
        response = await self.llm.generate(
            system_prompt=SYSTEM_PROMPT,
            user_message=transcript,
            tools=tool_registry,
        )

        # Scan the response before TTS speaks it
        output_decision = engine.evaluate(
            content=response,
            context={"stage": "output"},
        )

        if output_decision.action == "REDACT":
            response = output_decision.redacted_content

        return response


# ─────────────────────────────────────────────────────────────────
# Step 4: Run the voice agent
# ─────────────────────────────────────────────────────────────────

app = AtomsCrewApp(
    agent=GovernedSupportAgent(
        model="gpt-4o-mini",
        voice="sophia",
        language="en",
    ),
)

if __name__ == "__main__":
    print("Starting governed voice agent...")
    print("Governance: PII redaction, $2/call budget, tool allowlisting")
    print("Mode: ENFORCE (violations are blocked)")
    app.run()
