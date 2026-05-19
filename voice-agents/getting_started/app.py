"""Getting Started - Your first Atoms agent."""

from my_agent import MyAgent
from loguru import logger

from smallestai.atoms.swarm.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.swarm.server import AtomsSwarmApp
from smallestai.atoms.swarm.session import SwarmSession


async def setup_session(session: SwarmSession):
    """Configure the agent session."""
    agent = MyAgent()
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
    app = AtomsSwarmApp(setup_handler=setup_session)
    app.run()
