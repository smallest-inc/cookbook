"""Getting Started - Your first Atoms agent."""

from assistant import Assistant
from loguru import logger

from smallestai.atoms.crew.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession


async def setup_session(session: CrewSession):
    """Configure the agent session."""
    agent = Assistant()
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = "Hello! I'm your AI assistant. How can I help you today?"
            # Add to context so LLM knows conversation has started
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsCrewApp(setup_handler=setup_session)
    app.run()
