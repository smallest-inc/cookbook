"""A minimal OutputCrewNode. Same code runs on inbound and outbound calls."""

import os

from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.nodes import OutputCrewNode


class Assistant(OutputCrewNode):
    def __init__(self):
        super().__init__(name="assistant")
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        self.context.messages.append(
            {
                "role": "system",
                "content": "You are a concise voice assistant on a phone call. Keep replies under two sentences.",
            }
        )

    async def generate_response(self):
        response = await self.llm.chat(
            messages=self.context.messages, stream=True
        )
        full = ""
        async for chunk in response:
            if chunk.content:
                full += chunk.content
                yield chunk.content
        self.context.messages.append({"role": "assistant", "content": full})
