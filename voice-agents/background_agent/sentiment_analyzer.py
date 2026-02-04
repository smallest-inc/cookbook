"""Background agent for real-time sentiment analysis."""

import os
from typing import Dict, List

from dotenv import load_dotenv
from loguru import logger

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.events import (
    SDKAgentTranscriptUpdateEvent,
    SDKEvent,
    SDKSystemUserStartedSpeakingEvent,
    SDKSystemUserStoppedSpeakingEvent,
)
from smallestai.atoms.agent.nodes import BackgroundAgentNode

load_dotenv()


class SentimentAnalyzer(BackgroundAgentNode):
    """Analyzes user sentiment in real-time without producing output.
    
    This background agent:
    - Listens to transcript updates
    - Analyzes sentiment of user messages
    - Stores results for the main agent to query
    - Does NOT produce any audio output
    
    Use cases:
    - Escalation triggers (detect frustration)
    - Call quality monitoring
    - Real-time coaching for human agents
    """

    def __init__(self):
        super().__init__(name="sentiment-analyzer")
        self.llm = OpenAIClient(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Store sentiment history
        self.sentiment_history: List[Dict] = []
        self.current_sentiment: str = "neutral"
        self.frustration_count: int = 0
        
        # Track speaking state
        self.user_is_speaking: bool = False

    async def process_event(self, event: SDKEvent):
        """Process events in the background.
        
        BackgroundAgentNode receives all events but doesn't auto-handle them.
        We manually process the ones we care about.
        """
        
        # Track when user starts/stops speaking
        if isinstance(event, SDKSystemUserStartedSpeakingEvent):
            self.user_is_speaking = True
            logger.debug("[SentimentAnalyzer] User started speaking")
            
        elif isinstance(event, SDKSystemUserStoppedSpeakingEvent):
            self.user_is_speaking = False
            logger.debug("[SentimentAnalyzer] User stopped speaking")
            
        # Analyze sentiment when we get user transcripts
        elif isinstance(event, SDKAgentTranscriptUpdateEvent):
            if event.role == "user":
                await self._analyze_sentiment(event.content)

    async def _analyze_sentiment(self, text: str):
        """Analyze sentiment of user message."""
        try:
            response = await self.llm.chat(
                messages=[
                    {
                        "role": "system",
                        "content": """Analyze the sentiment of this customer message.
Respond with exactly one word: positive, neutral, negative, or frustrated.
Only respond with that single word."""
                    },
                    {"role": "user", "content": text}
                ],
                stream=False
            )
            
            sentiment = response.content.strip().lower()
            
            # Validate response
            if sentiment not in ["positive", "neutral", "negative", "frustrated"]:
                sentiment = "neutral"
            
            # Update state
            self.current_sentiment = sentiment
            self.sentiment_history.append({
                "text": text,
                "sentiment": sentiment
            })
            
            # Track frustration for escalation
            if sentiment in ["negative", "frustrated"]:
                self.frustration_count += 1
                logger.warning(
                    f"[SentimentAnalyzer] Detected {sentiment} sentiment "
                    f"(frustration count: {self.frustration_count})"
                )
            else:
                # Reset on positive interaction
                if sentiment == "positive":
                    self.frustration_count = max(0, self.frustration_count - 1)
                    
            logger.info(f"[SentimentAnalyzer] Sentiment: {sentiment}")
            
        except Exception as e:
            logger.error(f"[SentimentAnalyzer] Analysis failed: {e}")

    def should_escalate(self) -> bool:
        """Check if the call should be escalated based on sentiment."""
        return self.frustration_count >= 3

    def get_sentiment_summary(self) -> Dict:
        """Get summary of sentiment analysis for the call."""
        if not self.sentiment_history:
            return {"overall": "neutral", "history": []}
            
        sentiments = [s["sentiment"] for s in self.sentiment_history]
        
        # Simple majority sentiment
        from collections import Counter
        counts = Counter(sentiments)
        overall = counts.most_common(1)[0][0]
        
        return {
            "overall": overall,
            "current": self.current_sentiment,
            "frustration_count": self.frustration_count,
            "should_escalate": self.should_escalate(),
            "history": self.sentiment_history[-5:]  # Last 5 entries
        }
