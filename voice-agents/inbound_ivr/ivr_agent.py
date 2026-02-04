"""IVR Agent with intent routing and department transfers."""

import os
from typing import List

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.clients.types import ToolCall, ToolResult
from smallestai.atoms.agent.events import (
    SDKAgentControlMuteUserEvent,
    SDKAgentControlUnmuteUserEvent,
    SDKAgentEndCallEvent,
    SDKAgentTransferConversationEvent,
    TransferOption,
    TransferOptionType,
    WarmTransferHandoffOptionType,
    WarmTransferPrivateHandoffOption,
)
from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.tools import ToolRegistry, function_tool

load_dotenv()


# Department configuration
DEPARTMENTS = {
    "sales": {
        "number": "+1111111111",
        "description": "New orders, pricing, product information",
        "hours": "9 AM - 6 PM EST"
    },
    "support": {
        "number": "+2222222222",
        "description": "Technical issues, troubleshooting, account problems",
        "hours": "24/7"
    },
    "billing": {
        "number": "+3333333333",
        "description": "Invoices, payments, refunds",
        "hours": "9 AM - 5 PM EST"
    },
    "returns": {
        "number": "+4444444444",
        "description": "Return requests, exchanges, order cancellations",
        "hours": "9 AM - 5 PM EST"
    }
}


class IVRAgent(OutputAgentNode):
    """IVR-style agent that routes callers to the right department.
    
    Demonstrates:
    - Intent detection and routing
    - Department transfers (cold and warm)
    - Mute/unmute user during holds
    - Multi-department configuration
    """

    def __init__(self):
        super().__init__(name="ivr-agent")
        
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            temperature=0.3,  # Lower temperature for consistent routing
            api_key=os.getenv("OPENAI_API_KEY")
        )

        # Track call state
        self.detected_intent: str = None
        self.transfer_count: int = 0
        
        # Initialize tools
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        # Build department list for prompt
        dept_list = "\n".join([
            f"- {name}: {info['description']}"
            for name, info in DEPARTMENTS.items()
        ])

        self.context.add_message({
            "role": "system",
            "content": f"""You are a professional IVR (Interactive Voice Response) agent for TechCorp.

Your job is to:
1. Greet callers warmly
2. Understand what they need help with
3. Route them to the correct department

AVAILABLE DEPARTMENTS:
{dept_list}

ROUTING RULES:
- Ask clarifying questions if the intent is unclear
- Confirm the department before transferring
- Offer alternatives if the requested department is closed
- Use warm transfer for complex issues, cold transfer for simple routing

IMPORTANT:
- Be concise - IVR interactions should be quick
- Confirm before transferring: "I'll connect you to [department]. Is that correct?"
- If user says "operator" or "representative", transfer to support

Always use the appropriate tool to transfer or end the call.""",
        })

    async def generate_response(self):
        """Generate response with intent routing."""
        
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
    # DEPARTMENT TOOLS
    # =========================================

    @function_tool()
    def get_departments(self) -> str:
        """Get list of available departments and their descriptions.
        
        Use this to help the caller understand their options.
        """
        dept_info = []
        for name, info in DEPARTMENTS.items():
            dept_info.append(
                f"{name.title()}: {info['description']} (Hours: {info['hours']})"
            )
        return "\n".join(dept_info)

    @function_tool()
    async def transfer_to_department(
        self, 
        department: str, 
        reason: str,
        warm_transfer: bool = False
    ) -> str:
        """Transfer the caller to a specific department.
        
        Args:
            department: The department to transfer to (sales, support, billing, returns)
            reason: Brief summary of why the caller needs this department
            warm_transfer: If True, brief the receiving agent first. Use for complex issues.
        """
        dept = department.lower()
        
        if dept not in DEPARTMENTS:
            return f"Unknown department: {department}. Available: {', '.join(DEPARTMENTS.keys())}"
        
        dept_info = DEPARTMENTS[dept]
        self.detected_intent = dept
        self.transfer_count += 1
        
        logger.info(f"[IVR] Transferring to {dept}: {reason}")
        
        # Determine transfer type
        if warm_transfer:
            transfer_options = TransferOption(
                type=TransferOptionType.WARM_TRANSFER,
                private_handoff_option=WarmTransferPrivateHandoffOption(
                    type=WarmTransferHandoffOptionType.PROMPT,
                    prompt=f"Incoming call for {dept}. Reason: {reason}"
                )
            )
        else:
            transfer_options = TransferOption(
                type=TransferOptionType.COLD_TRANSFER
            )
        
        await self.send_event(
            SDKAgentTransferConversationEvent(
                transfer_call_number=dept_info["number"],
                transfer_options=transfer_options,
                on_hold_music="relaxing_sound"
            )
        )
        
        return f"Transferring to {dept.title()} department."

    # =========================================
    # MUTE/UNMUTE TOOLS
    # =========================================

    @function_tool()
    async def mute_caller(self) -> str:
        """Mute the caller's microphone.
        
        Use this when you need to:
        - Play hold music without background noise
        - Consult with another agent privately
        """
        await self.send_event(SDKAgentControlMuteUserEvent())
        logger.info("[IVR] Caller muted")
        return "Caller microphone muted."

    @function_tool()
    async def unmute_caller(self) -> str:
        """Unmute the caller's microphone.
        
        Use this after muting to resume normal conversation.
        """
        await self.send_event(SDKAgentControlUnmuteUserEvent())
        logger.info("[IVR] Caller unmuted")
        return "Caller microphone unmuted."

    # =========================================
    # CALL CONTROL
    # =========================================

    @function_tool()
    async def end_call(self) -> None:
        """End the call.
        
        Use when:
        - Caller says goodbye
        - Issue is resolved without transfer
        - Caller requests to end the call
        """
        await self.send_event(SDKAgentEndCallEvent())
        return None
