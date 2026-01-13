"""
Server entry point for the Weather/Booking agent.
Run: python server.py
"""

from agent import WeatherBookingAgent
from loguru import logger

from smallestai.atoms.agent.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.agent.server import AtomsApp
from smallestai.atoms.agent.session import AgentSession


async def setup_session(session: AgentSession):
    """Configure the agent session."""
    agent = WeatherBookingAgent(name="weather-booking-agent")
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event(_, event: SDKEvent):
        logger.info(f"Event: {event.type}")
        if isinstance(event, SDKSystemUserJoinedEvent):
            await agent.speak(
                "Hi! I can check the weather for any city or help you book appointments. "
                "What would you like to do?"
            )

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    print("=" * 50)
    print("Weather & Booking Agent")
    print("=" * 50)
    print("\nStarting server on ws://localhost:8080/ws")
    print("Connect with: smallestai agent chat")
    print("\nTry saying:")
    print("  - 'What's the weather in Tokyo?'")
    print("  - 'Book a haircut for tomorrow at 2pm'")
    print("  - 'Show my appointments'")
    print()
    
    app = AtomsApp(setup_handler=setup_session)
    app.run()
