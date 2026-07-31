"""Crew server. Same setup for inbound + outbound; the platform decides which."""

from assistant import Assistant
from loguru import logger

from smallestai.atoms.crew.events import (
    SDKEvent,
    SDKSystemUserJoinedEvent,
)
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession


async def setup_session(session: CrewSession):
    agent = Assistant()
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        # Fires on both inbound (caller dials in) and outbound (agent
        # dials and the callee picks up). Same handler, same greeting.
        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = "Hi! Thanks for taking the call. How can I help?"
            agent.context.messages.append(
                {"role": "assistant", "content": greeting}
            )
            await agent.speak(greeting)

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    AtomsCrewApp(setup_handler=setup_session).run()
