"""Language Switching Example - Multi-language support with auto-detection."""

from loguru import logger

from language_detector import LanguageDetector
from profanity_filter import ProfanityFilter
from support_agent import SupportAgent

from smallestai.atoms.agent.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.agent.server import AtomsApp
from smallestai.atoms.agent.session import AgentSession


async def setup_session(session: AgentSession):
    """Configure multi-node pipeline with explicit edges.
    
    Pipeline Architecture:
    
    ┌─────────┐    ┌──────────────────┐    ┌──────────────┐    ┌─────────────────┐
    │  Root   │───►│ LanguageDetector │───►│ SupportAgent │───►│ ProfanityFilter │───► Sink
    └─────────┘    └──────────────────┘    └──────────────┘    └─────────────────┘
    
    Events flow:
    1. Root receives events from WebSocket
    2. LanguageDetector detects language, forwards events
    3. SupportAgent generates responses, queries language info
    4. ProfanityFilter sanitizes responses before TTS
    5. Sink sends to WebSocket
    """
    
    # Create nodes
    language_detector = LanguageDetector()
    support_agent = SupportAgent(language_detector=language_detector)
    profanity_filter = ProfanityFilter()
    
    # Add nodes to session
    session.add_node(language_detector)
    session.add_node(support_agent)
    session.add_node(profanity_filter)
    
    # Create pipeline edges
    # Note: Nodes without incoming edges connect to Root automatically
    # Nodes without outgoing edges connect to Sink automatically
    session.add_edge(language_detector, support_agent)
    session.add_edge(support_agent, profanity_filter)
    
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = (
                "Hello! Welcome to our support line. "
                "I can help you in multiple languages. "
                "How can I assist you today?"
            )
            support_agent.context.add_message({"role": "assistant", "content": greeting})
            await support_agent.speak(greeting)

    await session.wait_until_complete()
    
    # Log pipeline stats
    logger.info(f"Language detected: {language_detector.get_primary_language()}")
    logger.info(f"Profanity filtered: {profanity_filter.filtered_count} times")
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsApp(setup_handler=setup_session)
    app.run()
