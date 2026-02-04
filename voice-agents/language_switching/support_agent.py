"""Support agent that works in a processing pipeline."""

import os
from typing import TYPE_CHECKING, List

from dotenv import load_dotenv

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.clients.types import ToolCall, ToolResult
from smallestai.atoms.agent.events import SDKAgentEndCallEvent
from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.tools import ToolRegistry, function_tool

if TYPE_CHECKING:
    from language_detector import LanguageDetector

load_dotenv()


class SupportAgent(OutputAgentNode):
    """Support agent that adapts based on pipeline node data.
    
    This agent:
    - Receives events from LanguageDetector node
    - Can query language info to adapt responses
    - Sends responses through ProfanityFilter before TTS
    """

    def __init__(self, language_detector: "LanguageDetector"):
        super().__init__(name="support-agent")
        
        self.language_detector = language_detector
        
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY")
        )

        # Initialize tools
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({
            "role": "system",
            "content": """You are a helpful multilingual support agent.

You can detect and respond in multiple languages:
- Use the get_user_language tool to check what language the user is speaking
- Respond in the same language as the user when appropriate
- Default to English if unsure

Be helpful, concise, and friendly.""",
        })

    async def generate_response(self):
        """Generate language-aware responses."""
        
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

    @function_tool()
    def get_user_language(self) -> str:
        """Get the detected language of the user.
        
        Use this to determine which language to respond in.
        Returns the detected language and confidence level.
        """
        return (
            f"User is speaking {self.language_detector.detected_language} "
            f"(confidence: {self.language_detector.language_confidence:.0%}). "
            f"Primary language this session: {self.language_detector.get_primary_language()}"
        )

    @function_tool()
    async def end_call(self) -> None:
        """End the call."""
        await self.send_event(SDKAgentEndCallEvent())
        return None
