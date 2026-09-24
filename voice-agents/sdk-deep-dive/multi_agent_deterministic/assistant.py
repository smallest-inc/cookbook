"""
Deterministic multi-agent in one crew node.

Three sub-agents (intake, verify, resolve). The transitions between them are computed
in plain Python off tool results, so they are deterministic and data-dependent, and a
sub-agent can be skipped based on data. Here, verify is skipped when the caller was
already verified on a prior interaction.

Each sub-agent is a system prompt plus a scoped set of tools, keyed by self.state. The
node swaps the active sub-agent every turn, and every transition is published as an
SDKAgentLogEvent so the sub-agent path shows up on the call's Events tab.
"""

import json
import os

from dotenv import load_dotenv

from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.events import SDKAgentLogEvent
from smallestai.atoms.crew.nodes import OutputCrewNode
from smallestai.atoms.crew.tools import ToolRegistry, function_tool

load_dotenv()

# fake backend. stands in for your CRM / system of record.
_CUSTOMERS = {
    "1001": {"name": "Jordan", "already_verified": True, "order": "shipped"},
    "1002": {"name": "Riley", "already_verified": False, "order": "delayed"},
}

# each sub-agent = a focused system prompt + the tools it is allowed to use
SUBAGENTS = {
    "intake": {
        "prompt": (
            "You are the intake step. Greet the caller and ask for their customer id. "
            "Call start_intake with the id. Keep it to one short sentence."
        ),
        "tools": ["start_intake"],
    },
    "verify": {
        "prompt": (
            "You are the verify step. Ask for the last 4 digits of the phone on file and "
            "call verify_caller. One short sentence."
        ),
        "tools": ["verify_caller"],
    },
    "resolve": {
        "prompt": (
            "You are the resolve step. Tell the caller their order status and ask if there "
            "is anything else. Use get_order_status. One or two short sentences."
        ),
        "tools": ["get_order_status"],
    },
}


class MultiAgentWorkflow(OutputCrewNode):
    def __init__(self) -> None:
        super().__init__(name="workflow")
        self.llm = OpenAIClient(
            model=os.getenv("CUSTOM_LLM_MODEL", "gpt-4o-mini"),
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("CUSTOM_LLM_BASE_URL", "https://api.openai.com/v1/"),
        )
        self.state = "intake"          # current sub-agent
        self.data: dict = {}           # collected across sub-agents
        self.registry = ToolRegistry()
        self.registry.discover(self)

    async def _go(self, next_state: str) -> None:
        """Deterministic transition, logged to the call Events tab."""
        await self.send_event(
            SDKAgentLogEvent(name="subagent_transition", payload={"from": self.state, "to": next_state})
        )
        self.state = next_state

    # --- tools, one set per sub-agent ---------------------------------------
    @function_tool(name="start_intake")
    async def start_intake(self, customer_id: str) -> str:
        """Look the caller up and decide the next sub-agent."""
        cust = _CUSTOMERS.get(customer_id.strip())
        if not cust:
            return json.dumps({"found": False})
        self.data["customer_id"] = customer_id.strip()
        self.data["name"] = cust["name"]
        # DETERMINISTIC, DATA-DEPENDENT TRANSITION: skip verify if already verified
        await self._go("resolve" if cust["already_verified"] else "verify")
        return json.dumps({"found": True, "name": cust["name"], "skipped_verify": cust["already_verified"]})

    @function_tool(name="verify_caller")
    async def verify_caller(self, phone_last4: str) -> str:
        """Verify identity, then move to resolve."""
        ok = len(phone_last4.strip()) == 4 and phone_last4.strip().isdigit()
        self.data["verified"] = ok
        if ok:
            await self._go("resolve")
        return json.dumps({"verified": ok})

    @function_tool(name="get_order_status")
    async def get_order_status(self) -> str:
        """Return the order status for the identified caller."""
        cust = _CUSTOMERS.get(self.data.get("customer_id", ""))
        return json.dumps({"order": cust["order"] if cust else "unknown"})

    # --- the turn: run the active sub-agent ---------------------------------
    async def generate_response(self):
        # rebuild context for the CURRENT sub-agent: its prompt + only its tools
        sub = SUBAGENTS[self.state]
        schemas = [s for s in self.registry.get_schemas() if s["function"]["name"] in sub["tools"]]
        system = {"role": "system", "content": sub["prompt"]}
        convo = [m for m in self.context.messages if m.get("role") != "system"]
        self.context.set_messages([system] + convo)

        for _ in range(4):
            resp = await self.llm.chat(messages=self.context.messages, stream=False, tools=schemas)
            if resp.tool_calls:
                self.context.add_message(
                    {"role": "assistant", "content": resp.content or "",
                     "tool_calls": [tc.to_dict() for tc in resp.tool_calls]}
                )
                for r in await self.registry.execute(resp.tool_calls):
                    self.context.add_message(r.to_message())
                # a tool may have flipped self.state; re-scope to the (possibly new) sub-agent
                sub = SUBAGENTS[self.state]
                schemas = [s for s in self.registry.get_schemas() if s["function"]["name"] in sub["tools"]]
                self.context.set_messages(
                    [{"role": "system", "content": sub["prompt"]}]
                    + [m for m in self.context.messages if m.get("role") != "system"]
                )
                continue
            if resp.content:
                self.context.add_message({"role": "assistant", "content": resp.content})
                yield resp.content
            return
