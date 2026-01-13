"""
Call Control Agent
===================
Agent that can end calls and transfer to humans.

Run: python server.py
Then: smallestai agent chat
"""

from smallestai.atoms.agent.nodes.output_agent import OutputAgentNode
from smallestai.atoms.agent.tools import function_tool
from smallestai.atoms.agent.events import (
    SDKAgentEndCallEvent,
    SDKAgentTransferConversationEvent,
    TransferOption,
    TransferOptionType
)


class SupportAgent(OutputAgentNode):
    """Customer support agent with call control capabilities."""
    
    def __init__(self, transfer_number: str = "+1234567890", **kwargs):
        super().__init__(**kwargs)
        self.transfer_number = transfer_number
        
        self.context.add_message({
            "role": "system",
            "content": """You are a customer support agent for TechCo.

You can help with:
- Product information
- Order status
- Technical issues
- Account questions

CALL CONTROL RULES:
1. When user says "goodbye", "bye", "that's all" → Use end_call tool
2. When user asks for "human", "supervisor", "real person" → Use transfer_to_human tool

Always be helpful and professional. Before ending, confirm the user doesn't need anything else.
Before transferring, let them know you're connecting them to a human."""
        })
    
    @function_tool()
    def end_call(self) -> SDKAgentEndCallEvent:
        """End the call gracefully. Use when the conversation is complete 
        and user says goodbye."""
        return SDKAgentEndCallEvent()
    
    @function_tool()
    def transfer_to_human(self) -> SDKAgentTransferConversationEvent:
        """Transfer the call to a human support agent. Use when user 
        explicitly asks for a real person or supervisor."""
        return SDKAgentTransferConversationEvent(
            transfer_call_number=self.transfer_number,
            transfer_options=TransferOption(type=TransferOptionType.COLD_TRANSFER),
            on_hold_music="relaxing_sound"
        )
    
    @function_tool()
    def lookup_order(self, order_id: str) -> str:
        """Look up order status.
        
        Args:
            order_id: The order ID to look up.
        """
        # Mock order data
        return f"Order {order_id}: Shipped on Jan 10, arriving Jan 15"
