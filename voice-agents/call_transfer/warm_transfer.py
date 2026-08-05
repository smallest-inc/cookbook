"""Crew agent that WARM-transfers a live call to a human.

Warm transfer = the agent first calls the specialist privately and briefs them
(the whisper / private_handoff_option), then bridges the caller in. Hold music
plays for the caller during the brief.

Same requirements as cold: a system prompt that tells the model to call
`transfer_call`, and TRANSFER_CALL_NUMBER set.
"""
import os
from dotenv import load_dotenv
from loguru import logger
from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.clients.types import ToolCall
from smallestai.atoms.crew.events import (
    SDKAgentTransferConversationEvent, TransferOption, TransferOptionType,
    WarmTransferPrivateHandoffOption, WarmTransferHandoffOptionType,
)
from smallestai.atoms.crew.nodes import OutputCrewNode
from smallestai.atoms.crew.tools import ToolRegistry, function_tool

load_dotenv()
TRANSFER_NUMBER = os.getenv("TRANSFER_CALL_NUMBER")


class Assistant(OutputCrewNode):
    def __init__(self):
        super().__init__(name="assistant")
        self.llm = OpenAIClient(
            model=os.getenv("CUSTOM_LLM_MODEL", "gpt-4o-mini"),
            api_key=os.getenv("OPENAI_API_KEY", "ollama"),
            base_url=os.getenv("CUSTOM_LLM_BASE_URL", "https://api.openai.com/v1/"),
        )
        self.context.add_message({"role": "system", "content":
            "You are Acme support. The MOMENT the caller asks for a human, a person, "
            "a specialist, or to be transferred, call the transfer_call tool immediately. "
            "Do not keep talking, just call the tool."})
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

    @function_tool(name="transfer_call")
    async def transfer_call(self) -> None:
        """Transfer the call to a human specialist."""
        if getattr(self, "_transferring", False):
            return
        self._transferring = True
        if not TRANSFER_NUMBER:
            logger.warning("transfer_call requested but TRANSFER_CALL_NUMBER is not set")
            return
        await self.speak("Sure, please hold while I connect you to a specialist.")
        await self.send_event(SDKAgentTransferConversationEvent(
            transfer_call_number=TRANSFER_NUMBER,
            transfer_options=TransferOption(
                type=TransferOptionType.WARM_TRANSFER,
                # Whisper: spoken only to the specialist before the bridge.
                private_handoff_option=WarmTransferPrivateHandoffOption(
                    type=WarmTransferHandoffOptionType.PROMPT,
                    prompt="Greet the specialist and briefly summarize the caller's issue.",
                ),
            ),
            on_hold_music="relaxing_sound",   # plays for the caller during the brief
        ))
        logger.info("warm transfer -> {}", TRANSFER_NUMBER)

    async def generate_response(self):
        response = await self.llm.chat(messages=self.context.messages, stream=True, tools=self.tool_schemas)
        full = ""
        tool_calls: list[ToolCall] = []
        async for ch in response:
            if ch.content:
                full += ch.content
                yield ch.content
            if ch.tool_calls:
                tool_calls.extend(ch.tool_calls)
        if tool_calls:
            await self.tool_registry.execute(tool_calls=tool_calls, parallel=True)
            return
        if full:
            self.context.add_message({"role": "assistant", "content": full})
