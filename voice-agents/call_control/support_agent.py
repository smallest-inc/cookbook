"""Support agent demonstrating all call control capabilities."""

import os
from typing import List

from dotenv import load_dotenv

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.clients.types import ToolCall, ToolResult
from smallestai.atoms.agent.events import (
    SDKAgentEndCallEvent,
    SDKAgentTransferConversationEvent,
    TransferOption,
    TransferOptionType,
    WarmTransferPrivateHandoffOption,
    WarmTransferHandoffOptionType,
)
from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.tools import ToolRegistry, function_tool

load_dotenv()


class SupportAgent(OutputAgentNode):
    """Support agent with comprehensive call control capabilities.
    
    Demonstrates:
    - End call gracefully
    - Cold transfer (immediate handoff)
    - Warm transfer (briefing before handoff)
    - Different hold music options
    """

    def __init__(
        self, 
        cold_transfer_number: str = "+1234567890",
        warm_transfer_number: str = "+1987654321"
    ):
        super().__init__(name="support-agent")
        self.cold_transfer_number = cold_transfer_number
        self.warm_transfer_number = warm_transfer_number
        
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY")
        )

        # Initialize tool registry
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({
            "role": "system",
            "content": """You are a customer support agent for TechCo.

You can help with:
- Product information and order status
- Technical issues

CALL CONTROL ACTIONS:
1. "goodbye"/"bye"/"that's all" → Use end_call
2. "talk to someone"/"human agent" → Use cold_transfer (faster)
3. "supervisor"/"manager"/"escalate" → Use warm_transfer (you brief them first)

Before ending: Confirm user doesn't need anything else.
Before cold transfer: Say "I'll connect you now, please hold."
Before warm transfer: Say "I'll brief my supervisor and connect you."
""",
        })

    async def generate_response(self):
        """Generate response with tool calling support."""
        response = await self.llm.chat(
            messages=self.context.messages,
            stream=True,
            tools=self.tool_schemas
        )

        tool_calls: List[ToolCall] = []
        full_response = ""

        async for chunk in response:
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
            if chunk.tool_calls:
                tool_calls.extend(chunk.tool_calls)

        # Add assistant response to context (if no tool calls)
        if full_response and not tool_calls:
            self.context.add_message({"role": "assistant", "content": full_response})

        if tool_calls:
            results: List[ToolResult] = await self.tool_registry.execute(
                tool_calls=tool_calls, parallel=True
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

            final_response = await self.llm.chat(
                messages=self.context.messages, stream=True
            )

            async for chunk in final_response:
                if chunk.content:
                    yield chunk.content

    # =========================================
    # CALL CONTROL TOOLS
    # =========================================

    @function_tool()
    async def end_call(self) -> None:
        """End the call gracefully.
        
        Use when the user says goodbye or indicates they're done.
        The call will be terminated after this event is sent.
        """
        await self.send_event(SDKAgentEndCallEvent())
        return None

    @function_tool()
    async def cold_transfer(self) -> None:
        """Immediately transfer to a human agent (cold transfer).
        
        Use when user asks for a "real person" or "human agent".
        The call is transferred immediately without briefing.
        User will hear hold music while connecting.
        """
        await self.send_event(
            SDKAgentTransferConversationEvent(
                transfer_call_number=self.cold_transfer_number,
                transfer_options=TransferOption(
                    type=TransferOptionType.COLD_TRANSFER
                ),
                on_hold_music="relaxing_sound"
            )
        )
        return None

    @function_tool()
    async def warm_transfer(self, reason: str) -> None:
        """Brief the supervisor first, then transfer (warm transfer).
        
        Use when user asks for a "supervisor" or "manager" or wants to escalate.
        You'll first brief the receiving agent, then they take over.
        
        Args:
            reason: Brief summary of the issue for the supervisor.
        """
        await self.send_event(
            SDKAgentTransferConversationEvent(
                transfer_call_number=self.warm_transfer_number,
                transfer_options=TransferOption(
                    type=TransferOptionType.WARM_TRANSFER,
                    private_handoff_option=WarmTransferPrivateHandoffOption(
                        type=WarmTransferHandoffOptionType.PROMPT,
                        prompt=f"Customer escalation: {reason}"
                    )
                ),
                on_hold_music="uplifting_beats"
            )
        )
        return None

    # =========================================
    # BUSINESS TOOLS
    # =========================================

    @function_tool()
    def lookup_order(self, order_id: str) -> str:
        """Look up order status by order ID.
        
        Args:
            order_id: The order ID to look up.
        """
        # Mock order data
        orders = {
            "ORD-001": "Shipped on Jan 10, arriving Jan 15",
            "ORD-002": "Processing, expected ship Jan 14",
            "ORD-003": "Delivered Jan 8",
        }
        return orders.get(order_id, f"Order {order_id} not found. Please verify the order ID.")
