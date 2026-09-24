"""
Crew server for the collections callback agent.

Run locally:   python server.py            # boots ws://localhost:8080/ws
Talk to it:    smallestai agent-crew chat   # in another terminal
Deploy:        smallestai agent-crew deploy --entry-point server.py
"""

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
            greeting = (
                "Hi, this is Riley calling from Northwind Recovery on a recorded line. "
                "Am I speaking with the account holder?"
            )
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsCrewApp(setup_handler=setup_session)
    app.run()
