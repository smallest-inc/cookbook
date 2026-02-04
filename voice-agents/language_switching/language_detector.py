"""Language detection node that processes user input before the main agent."""

import os
from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.events import (
    SDKAgentTranscriptUpdateEvent,
    SDKEvent,
)
from smallestai.atoms.agent.nodes.base import Node

load_dotenv()


class LanguageDetector(Node):
    """Detects language and enriches events for downstream nodes.
    
    This node:
    - Intercepts transcript updates
    - Detects the language of user messages
    - Stores language info for other nodes to query
    - Passes events downstream unchanged
    
    Use cases:
    - Multi-language support
    - Language-based routing
    - Analytics
    """

    def __init__(self):
        super().__init__(name="language-detector")
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        self.detected_language: str = "english"
        self.language_confidence: float = 1.0
        self.language_history: list = []

    async def process_event(self, event: SDKEvent):
        """Process event and pass it downstream."""
        
        if isinstance(event, SDKAgentTranscriptUpdateEvent):
            if event.role == "user":
                await self._detect_language(event.content)
        
        # IMPORTANT: Forward event to children
        await self.send_event(event)

    async def _detect_language(self, text: str):
        """Detect language of the text."""
        try:
            response = await self.llm.chat(
                messages=[
                    {
                        "role": "system",
                        "content": """Detect the language of the text.
Respond with JSON: {"language": "english", "confidence": 0.95}
Common languages: english, spanish, french, german, portuguese, chinese, japanese, korean, hindi, arabic
Only respond with the JSON, nothing else."""
                    },
                    {"role": "user", "content": text}
                ],
                stream=False
            )
            
            import json
            result = json.loads(response.content)
            
            self.detected_language = result.get("language", "english").lower()
            self.language_confidence = result.get("confidence", 0.5)
            self.language_history.append(self.detected_language)
            
            logger.info(
                f"[LanguageDetector] Detected: {self.detected_language} "
                f"(confidence: {self.language_confidence:.0%})"
            )
            
        except Exception as e:
            logger.error(f"[LanguageDetector] Detection failed: {e}")
            self.detected_language = "english"
            self.language_confidence = 0.5

    def get_primary_language(self) -> str:
        """Get the most commonly detected language in this session."""
        if not self.language_history:
            return "english"
        
        from collections import Counter
        counts = Counter(self.language_history)
        return counts.most_common(1)[0][0]
