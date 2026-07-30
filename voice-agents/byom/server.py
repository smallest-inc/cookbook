"""Crew server. The LLM is fully configured on the node; server.py is generic."""

from assistant import Assistant
from loguru import logger

from smallestai.atoms.crew.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession


async def setup_session(session: CrewSession):
    agent = Assistant()
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = "Hi! I'm running on a custom model. Ask me anything."
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    AtomsCrewApp(setup_handler=setup_session).run()
