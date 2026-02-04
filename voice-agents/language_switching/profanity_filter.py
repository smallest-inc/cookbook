"""Profanity filter node that sanitizes agent responses."""

import re
from loguru import logger

from smallestai.atoms.agent.events import (
    SDKAgentLLMResponseChunkEvent,
    SDKEvent,
)
from smallestai.atoms.agent.nodes.base import Node


# Simple profanity list (in production, use a proper library)
PROFANITY_WORDS = {
    "damn", "hell", "crap"  # Add more as needed
}


class ProfanityFilter(Node):
    """Filters profanity from agent responses before they reach TTS.
    
    This node:
    - Intercepts LLM response chunks
    - Sanitizes any inappropriate language
    - Passes clean text downstream
    
    Position in pipeline: After OutputAgentNode, before Sink
    """

    def __init__(self):
        super().__init__(name="profanity-filter")
        self.filtered_count: int = 0

    async def process_event(self, event: SDKEvent):
        """Filter response chunks and pass downstream."""
        
        if isinstance(event, SDKAgentLLMResponseChunkEvent):
            # Filter the text
            filtered_text = self._filter_text(event.text)
            
            if filtered_text != event.text:
                self.filtered_count += 1
                logger.warning(f"[ProfanityFilter] Filtered content")
            
            # Create new event with filtered text
            filtered_event = SDKAgentLLMResponseChunkEvent(text=filtered_text)
            await self.send_event(filtered_event)
        else:
            # Pass through unchanged
            await self.send_event(event)

    def _filter_text(self, text: str) -> str:
        """Replace profanity with asterisks."""
        result = text
        
        for word in PROFANITY_WORDS:
            # Case-insensitive replacement
            pattern = re.compile(re.escape(word), re.IGNORECASE)
            replacement = "*" * len(word)
            result = pattern.sub(replacement, result)
        
        return result
