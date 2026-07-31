"""OpenAI-compatible LLM configurable via LLM_MODEL / LLM_API_KEY / LLM_BASE_URL.

Set LLM_BASE_URL to point at hosted Claude, Ollama, vLLM, or any endpoint
that speaks `POST /v1/chat/completions`. Leave it unset to use OpenAI.
"""

import os

from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.nodes import OutputCrewNode


class Assistant(OutputCrewNode):
    def __init__(self):
        super().__init__(name="assistant")
        self.llm = OpenAIClient(
            model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
            api_key=os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "")),
            base_url=os.getenv("LLM_BASE_URL") or None,
        )
        self.context.messages.append(
            {
                "role": "system",
                "content": "You are a concise voice assistant. Keep replies under two sentences.",
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
        self.context.add_message({"role": "assistant", "content": full})
