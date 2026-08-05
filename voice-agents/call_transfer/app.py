"""Deploy entry point. Picks the transfer example via TRANSFER_MODE (cold|warm).

Both examples are identical except for the transfer type, and both work for
inbound AND outbound calls. See cold_transfer.py / warm_transfer.py.
"""
import os
from dotenv import load_dotenv
from smallestai.atoms.crew.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession

load_dotenv()

if os.getenv("TRANSFER_MODE", "cold").lower() == "warm":
    from warm_transfer import Assistant
else:
    from cold_transfer import Assistant


async def setup_session(session: CrewSession):
    agent = Assistant()
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def _(_, e: SDKEvent):
        # Greet on pickup — fires for both inbound and outbound calls.
        if isinstance(e, SDKSystemUserJoinedEvent):
            await agent.speak("Hi, this is Acme support. How can I help?")

    await session.wait_until_complete()


if __name__ == "__main__":
    AtomsCrewApp(setup_handler=setup_session).run()
