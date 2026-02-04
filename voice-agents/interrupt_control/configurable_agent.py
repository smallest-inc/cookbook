"""Agent with runtime-configurable settings."""

import os
from typing import List

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.clients.types import ToolCall, ToolResult
from smallestai.atoms.agent.events import (
    SDKAgentEndCallEvent,
    SDKAgentControlMuteUserEvent,
    SDKAgentControlUnmuteUserEvent,
)
from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.tools import ToolRegistry, function_tool

load_dotenv()


class ConfigurableAgent(OutputAgentNode):
    """Agent that can dynamically mute/unmute user to control interrupts.
    
    Key mechanism:
    - SDKAgentControlMuteUserEvent: Mute user mic (no interrupts possible)
    - SDKAgentControlUnmuteUserEvent: Unmute user mic (normal behavior)
    - Auto-unmutes after each response completes
    """

    def __init__(self):
        super().__init__(name="configurable-agent")
        
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY")
        )

        # Track if user is muted (for auto-unmute)
        self.user_muted = False

        # Initialize tools
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({
            "role": "system",
            "content": """You are a helpful assistant that can control whether the user can interrupt you.

Tools:
- set_interruptible(False): Mute user so they cannot interrupt your next response
- set_interruptible(True): Unmute user (normal mode)
- check_settings: See current state

RULES:
1. When asked to speak without interruption: call set_interruptible(False), then speak
2. Do NOT announce that you're muting - just do it and speak the content
3. User is auto-unmuted after each response, so mute only lasts for one response

Example: "say 7 words without interruption"
→ Call set_interruptible(False)
→ Then ONLY say: "Here are exactly seven words for you"
→ User auto-unmutes after you finish""",
        })

    async def generate_response(self):
        """Generate response, auto-unmute at end if muted."""
        
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
                    {"role": "tool", "tool_call_id": tc.id, "content": result.content}
                    for tc, result in zip(tool_calls, results)
                ],
            ])

            final_response = await self.llm.chat(
                messages=self.context.messages, stream=True
            )

            async for chunk in final_response:
                if chunk.content:
                    yield chunk.content
        
        # Auto-unmute after response finishes
        if self.user_muted:
            await self.send_event(SDKAgentControlUnmuteUserEvent())
            self.user_muted = False
            logger.info("[ConfigurableAgent] Response done, user unmuted")

    @function_tool()
    def check_settings(self) -> str:
        """Check if user is currently muted."""
        return f"User muted: {self.user_muted}"

    @function_tool()
    async def set_interruptible(self, enabled: bool) -> str:
        """Mute or unmute the user.
        
        Args:
            enabled: True = user can interrupt (unmuted), False = user cannot interrupt (muted)
        """
        if enabled:
            # Unmute
            await self.send_event(SDKAgentControlUnmuteUserEvent())
            self.user_muted = False
            logger.info("[ConfigurableAgent] User unmuted")
            return "User unmuted. They can now interrupt."
        else:
            # Mute
            await self.send_event(SDKAgentControlMuteUserEvent())
            self.user_muted = True
            logger.info("[ConfigurableAgent] User muted")
            return "User muted. Speak your message now - they cannot interrupt. Will auto-unmute when done."

    @function_tool()
    async def end_call(self) -> None:
        """End the call."""
        await self.send_event(SDKAgentEndCallEvent())
        return None
