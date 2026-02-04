"""Simple conversational agent."""

import os
from dotenv import load_dotenv

from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.clients.openai import OpenAIClient

load_dotenv()


class MyAgent(OutputAgentNode):
    """Basic agent that streams LLM responses."""
    
    def __init__(self):
        super().__init__(name="my-agent")
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        self.context.add_message({
            "role": "system",
            "content": "You are a helpful assistant. Be concise and friendly."
        })

    async def generate_response(self):
        """Stream LLM response chunks."""
        response = await self.llm.chat(
            messages=self.context.messages,
            stream=True
        )
        
        full_response = ""
        async for chunk in response:
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
        
        # Add assistant response to context for conversation continuity
        if full_response:
            self.context.add_message({"role": "assistant", "content": full_response})