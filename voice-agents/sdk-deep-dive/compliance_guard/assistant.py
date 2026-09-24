"""
Collections callback agent, a deployable crew node.

Same brain as the in-process demo (compliance guard, tools, warm transfer),
structured as a real crew node you run with `python server.py` and ship with
`smallestai agent-crew deploy`. The platform wraps it with STT, TTS, and telephony.

CODE WALKTHROUGH (for presenting)

  1. The node. `Assistant` subclasses `OutputCrewNode`. A crew node owns one thing,
     the LLM turn. You write this class, deploy it, and the platform runs it. STT,
     TTS, voice, telephony, recording, and redaction are agent config, not code.

  2. The LLM. `self.llm = OpenAIClient(...)` points at any OpenAI-compatible endpoint.
     Here it is Claude via Anthropic. Swap the base_url to use your own model. This is
     the "bring your own brain" part.

  3. The system prompt. Added to `self.context` in __init__. It encodes the playbook,
     including the hard rule that the disclosure must run before any balance.

  4. Tools. Each `@function_tool` method is a function the LLM is allowed to call. The
     decorator registers it, it is not itself a call. At runtime the model decides when
     to call one (for example verify_identity), the node runs it, and feeds the result
     back. `ToolRegistry` collects them and `get_schemas()` describes them to the model.

  5. The compliance guard. `get_account_balance` returns BLOCKED unless the disclosure
     and identity checks already ran. This is enforced in the tool, so the model cannot
     talk its way past it. That is the point, a rule the agent obeys.

  6. Transfer. `transfer_to_human` emits `SDKAgentTransferConversationEvent`. On a real
     call the platform bridges the caller to a human. The node stops generating after.

  7. The turn loop. `generate_response` streams the model, yields text to TTS as it
     arrives, collects any tool calls, runs them, feeds results back, and loops until
     the model produces a final spoken reply with no more tool calls.

PREREQUISITE. `agent-crew init` links this project to an agent that already exists.
Create the agent first, on the dashboard or with `SmallestAI().atoms.agents.create_agent`,
then `agent-crew init --agent-id <id>`. Deploy does not create an agent.
"""

import json
import os

from dotenv import load_dotenv
from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.events import (
    SDKAgentTransferConversationEvent,
    TransferOption,
    TransferOptionType,
)
from smallestai.atoms.crew.nodes import OutputCrewNode
from smallestai.atoms.crew.tools import ToolRegistry, function_tool

load_dotenv()

# fake CRM / collections backend (stands in for the customer's system)
_ACCT = {
    "name": "Jordan Rivera",
    "dob_last4": "0713",
    "balance_usd": 428.55,
    "days_overdue": 34,
}
HUMAN_COLLECTOR = os.getenv("TRANSFER_CALL_NUMBER", "+917066487364")


class Assistant(OutputCrewNode):
    """The LLM turn for a compliant collections callback bot."""

    def __init__(self) -> None:
        super().__init__(name="collections")
        self.llm = OpenAIClient(
            model=os.getenv("CUSTOM_LLM_MODEL", "claude-haiku-4-5"),
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            base_url=os.getenv("CUSTOM_LLM_BASE_URL", "https://api.anthropic.com/v1/"),
        )
        self.context.add_message(
            {
                "role": "system",
                "content": (
                    "You are Riley, a collections voice agent for Northwind Recovery, "
                    "calling account 4821 about an overdue balance. One or two short spoken "
                    "sentences per turn. Follow this exactly:\n"
                    "1) Greet, say you're on a recorded line.\n"
                    "2) BEFORE any debt detail you MUST call give_required_disclosure "
                    "(FDCPA mini-Miranda). Never state a balance before that.\n"
                    "3) Verify identity with verify_identity (date-of-birth last 4).\n"
                    "4) Only then use get_account_balance and tell them.\n"
                    "5) Offer offer_payment_plan if they can't pay in full.\n"
                    "6) If they dispute or ask for a human, call transfer_to_human immediately."
                ),
            }
        )
        self.state = {"disclosure_given": False, "identity_verified": False}
        self.registry = ToolRegistry()
        self.registry.discover(self)
        self.tool_schemas = self.registry.get_schemas()

    @function_tool(name="give_required_disclosure")
    async def give_required_disclosure(self) -> str:
        """Deliver the required mini-Miranda disclosure before any debt detail."""
        self.state["disclosure_given"] = True
        return "Disclosure delivered: this is an attempt to collect a debt."

    @function_tool(name="verify_identity")
    async def verify_identity(self, dob_last4: str) -> str:
        """Verify the caller by the last 4 digits of date of birth."""
        ok = dob_last4.strip() == _ACCT["dob_last4"]
        self.state["identity_verified"] = ok
        return json.dumps({"verified": ok, "name": _ACCT["name"] if ok else None})

    @function_tool(name="get_account_balance")
    async def get_account_balance(self) -> str:
        """Return the overdue balance. Blocked until disclosure + identity done."""
        if not self.state["disclosure_given"]:
            return json.dumps({"error": "BLOCKED: give_required_disclosure first."})
        if not self.state["identity_verified"]:
            return json.dumps({"error": "BLOCKED: verify identity first."})
        return json.dumps(
            {"balance_usd": _ACCT["balance_usd"], "days_overdue": _ACCT["days_overdue"]}
        )

    @function_tool(name="offer_payment_plan")
    async def offer_payment_plan(self) -> str:
        """Offer a minimum monthly payment plan."""
        return json.dumps({"min_monthly_usd": 50.0, "months": 9})

    @function_tool(name="transfer_to_human")
    async def transfer_to_human(self, reason: str) -> None:
        """Warm-transfer to a human collector, carrying context."""
        await self.send_event(
            SDKAgentTransferConversationEvent(
                transfer_call_number=HUMAN_COLLECTOR,
                transfer_options=TransferOption(type=TransferOptionType.WARM_TRANSFER),
                on_hold_music="relaxing_sound",
            )
        )

    async def generate_response(self):
        """Streaming caller-driven tool loop. Streams the spoken reply so the
        first word reaches TTS as soon as the model produces it (lower latency),
        while still running the tool loop for tool-calling turns."""
        for _ in range(6):
            content_parts: list[str] = []
            tool_calls: list = []
            stream = await self.llm.chat(
                messages=self.context.messages, stream=True, tools=self.tool_schemas
            )
            async for chunk in stream:
                if chunk.content:
                    content_parts.append(chunk.content)
                    yield chunk.content  # -> TTS immediately, no wait for the full turn
                if chunk.tool_calls:
                    tool_calls.extend(chunk.tool_calls)
            text = "".join(content_parts)
            if tool_calls:
                self.context.add_message(
                    {
                        "role": "assistant",
                        "content": text,
                        "tool_calls": [tc.to_dict() for tc in tool_calls],
                    }
                )
                for r in await self.registry.execute(tool_calls):
                    self.context.add_message(r.to_message())
                if self._handoff_started:  # transfer emitted -> stop generating
                    return
                continue
            if text:
                self.context.add_message({"role": "assistant", "content": text})
            return
