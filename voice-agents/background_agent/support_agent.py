"""Main support agent that works alongside the sentiment analyzer."""

import os
from typing import TYPE_CHECKING, List

from dotenv import load_dotenv

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.clients.types import ToolCall, ToolResult
from smallestai.atoms.agent.events import SDKAgentEndCallEvent
from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.tools import ToolRegistry, function_tool

if TYPE_CHECKING:
    from sentiment_analyzer import SentimentAnalyzer

load_dotenv()


class SupportAgent(OutputAgentNode):
    """Support agent with access to background sentiment analysis.
    
    Demonstrates:
    - Working alongside a BackgroundAgentNode
    - Querying background agent state
    - Auto-escalation based on sentiment
    """

    def __init__(self, sentiment_analyzer: "SentimentAnalyzer"):
        super().__init__(name="support-agent")
        
        # Reference to background agent for querying state
        self.sentiment_analyzer = sentiment_analyzer
        
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
            "content": """You are a helpful customer support agent.

You have tools to:
- Check the current customer sentiment (use this to adapt your tone)
- Check if escalation is needed
- End the call
- Transfer to a supervisor

IMPORTANT: Be extra empathetic if sentiment is negative or frustrated.
If the customer seems very upset, proactively offer to transfer to a supervisor.

Keep responses concise and helpful.""",
        })

    async def generate_response(self):
        """Generate response with sentiment awareness."""
        
        # Check if auto-escalation is needed before responding
        if self.sentiment_analyzer.should_escalate():
            yield "I can hear this has been frustrating. "
            yield "I sincerely apologize for the experience you've had. "
            yield "Let me do my absolute best to help you resolve this right now."
            # Reset frustration after acknowledgment
            self.sentiment_analyzer.frustration_count = 0
            return

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

    # =========================================
    # SENTIMENT TOOLS (query background agent)
    # =========================================

    @function_tool()
    def get_customer_sentiment(self) -> str:
        """Get the current customer sentiment analysis.
        
        Returns the customer's current mood and frustration level.
        Use this to adapt your tone and approach.
        """
        summary = self.sentiment_analyzer.get_sentiment_summary()
        return (
            f"Current sentiment: {summary['current']}. "
            f"Overall mood: {summary['overall']}. "
            f"Frustration level: {summary['frustration_count']}/3 "
            f"(escalation threshold)."
        )

    @function_tool()
    def check_escalation_needed(self) -> str:
        """Check if the customer needs to be transferred to a supervisor.
        
        Based on sentiment analysis, determines if escalation is warranted.
        """
        if self.sentiment_analyzer.should_escalate():
            return "YES - Customer frustration is high. Recommend immediate transfer to supervisor."
        return "NO - Customer sentiment is manageable. Continue assisting."

    # =========================================
    # CALL CONTROL TOOLS
    # =========================================

    @function_tool()
    async def end_call(self) -> None:
        """End the call gracefully."""
        await self.send_event(SDKAgentEndCallEvent())
        return None

    @function_tool()
    async def transfer_to_supervisor(self) -> str:
        """Transfer the call to a supervisor for escalation.
        
        Note: Transfer functionality requires phone number configuration.
        For demo purposes, this logs the intent and returns a message.
        """
        from loguru import logger
        summary = self.sentiment_analyzer.get_sentiment_summary()
        logger.info(f"[SupportAgent] Transfer requested. Sentiment summary: {summary}")
        return "I've noted your request to speak with a supervisor. In a production setup, you would now be transferred."
