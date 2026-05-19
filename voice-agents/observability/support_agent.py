"""Simple support agent that logs everything to the LangfuseLogger.

Intentionally kept minimal — the focus of this cookbook is the
observability node, not the agent logic.  See ``bank_csr`` for
a more complex agent with multi-round tool chaining.
"""

import os
from typing import Any, List, Optional

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.swarm.clients.openai import OpenAIClient
from smallestai.atoms.swarm.clients.types import ToolCall, ToolResult
from smallestai.atoms.swarm.events import SDKAgentEndCallEvent
from smallestai.atoms.swarm.nodes import OutputSwarmNode
from smallestai.atoms.swarm.tools import ToolRegistry, function_tool

from langfuse_logger import LangfuseLogger

load_dotenv()


SYSTEM_PROMPT = """\
You are a friendly customer-support agent for an e-commerce store.

You have tools to:
- Look up order status
- Check return eligibility
- End the call

Keep responses short and helpful (1-3 sentences).\
"""


class SupportAgent(OutputSwarmNode):
    """Support agent that pushes tool calls and LLM rounds to LangfuseLogger."""

    def __init__(self, langfuse: Optional[LangfuseLogger] = None):
        super().__init__(name="support-agent")

        self.langfuse = langfuse

        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY"),
        )

        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({"role": "system", "content": SYSTEM_PROMPT})

    # ------------------------------------------------------------------
    # Response loop
    # ------------------------------------------------------------------

    async def generate_response(self):
        """Generate a response, logging each round to Langfuse."""

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

        # Log the LLM generation to Langfuse
        if self.langfuse:
            self.langfuse.log_generation(
                model="gpt-4o-mini",
                messages=self.context.messages,
                output=full_response,
                tool_calls=[
                    {"name": tc.name, "arguments": tc.arguments}
                    for tc in tool_calls
                ] if tool_calls else None,
            )

        if full_response and not tool_calls:
            self.context.add_message(
                {"role": "assistant", "content": full_response}
            )

        if tool_calls:
            results: List[ToolResult] = await self.tool_registry.execute(
                tool_calls=tool_calls, parallel=True
            )

            # Log each tool call to Langfuse
            if self.langfuse:
                for tc, result in zip(tool_calls, results):
                    self.langfuse.log_tool_call(
                        tool_name=tc.name,
                        args=tc.arguments if isinstance(tc.arguments, dict) else {},
                        result="" if result.content is None else str(result.content),
                    )

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
                                "arguments": str(tc.arguments),
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

            # Second LLM call to produce the final answer
            final_response = await self.llm.chat(
                messages=self.context.messages, stream=True
            )

            final_text = ""
            async for chunk in final_response:
                if chunk.content:
                    final_text += chunk.content
                    yield chunk.content

            if self.langfuse:
                self.langfuse.log_generation(
                    model="gpt-4o-mini",
                    messages=self.context.messages,
                    output=final_text,
                )

            if final_text:
                self.context.add_message(
                    {"role": "assistant", "content": final_text}
                )

    # ------------------------------------------------------------------
    # Tools
    # ------------------------------------------------------------------

    @function_tool()
    def lookup_order(self, order_id: str) -> str:
        """Look up order status by order ID.

        Args:
            order_id: The order ID to look up.
        """
        # Simulated data
        orders = {
            "ORD-1234": "Shipped — arriving Feb 12",
            "ORD-5678": "Processing — expected ship date Feb 15",
            "ORD-9999": "Delivered on Feb 5",
        }
        return orders.get(order_id, f"Order {order_id} not found.")

    @function_tool()
    def check_return_eligibility(self, order_id: str) -> str:
        """Check if an order is eligible for return.

        Args:
            order_id: The order ID to check.
        """
        # Simulated: delivered orders are eligible within 30 days
        if order_id == "ORD-9999":
            return "Eligible for return until March 7. Would you like to initiate?"
        return f"Order {order_id} is not eligible for return (not yet delivered or outside window)."

    @function_tool()
    async def end_call(self) -> None:
        """End the call gracefully when the customer says goodbye."""
        if self.langfuse:
            self.langfuse.log_event("call-control:end-call")
        await self.send_event(SDKAgentEndCallEvent())
        return None
