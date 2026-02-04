"""Background Agent Example - Multi-node architecture with sentiment analysis."""

from loguru import logger

from sentiment_analyzer import SentimentAnalyzer
from support_agent import SupportAgent

from smallestai.atoms.agent.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.agent.server import AtomsApp
from smallestai.atoms.agent.session import AgentSession


async def setup_session(session: AgentSession):
    """Configure multi-node session with background processing.
    
    Architecture:
    - SentimentAnalyzer (BackgroundAgentNode): Processes all events, analyzes sentiment
    - SupportAgent (OutputAgentNode): Handles conversation, queries sentiment state
    
    Both nodes run in parallel, receiving the same events.
    """
    
    # Create background agent for sentiment analysis
    sentiment_analyzer = SentimentAnalyzer()
    
    # Create main agent with reference to background agent
    support_agent = SupportAgent(sentiment_analyzer=sentiment_analyzer)
    
    # Add both nodes to session - they run in parallel
    session.add_node(sentiment_analyzer)
    session.add_node(support_agent)
    
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = (
                "Hello! I'm here to help. What can I assist you with today?"
            )
            support_agent.context.add_message({"role": "assistant", "content": greeting})
            await support_agent.speak(greeting)

    await session.wait_until_complete()
    
    # Log final sentiment summary
    summary = sentiment_analyzer.get_sentiment_summary()
    logger.info(f"Call sentiment summary: {summary}")
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsApp(setup_handler=setup_session)
    app.run()
