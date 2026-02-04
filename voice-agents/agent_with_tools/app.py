"""Agent with Tools Example - Custom function tools using decorator pattern."""

from assistant_agent import AssistantAgent
from loguru import logger

from smallestai.atoms.agent.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.agent.server import AtomsApp
from smallestai.atoms.agent.session import AgentSession


async def setup_session(session: AgentSession):
    """Configure assistant agent with custom tools."""
    assistant = AssistantAgent()
    session.add_node(assistant)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = "Hello! I can check the weather, book appointments, and list your schedule. How can I help?"
            # Add to context so LLM knows conversation has started
            assistant.context.add_message({"role": "assistant", "content": greeting})
            await assistant.speak(greeting)

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsApp(setup_handler=setup_session)
    app.run()
