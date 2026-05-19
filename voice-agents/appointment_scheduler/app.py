"""Appointment Scheduler — Voice-based clinic receptionist with Cal.com.

Demonstrates real calendar availability checking, slot negotiation,
and booking — powered by Cal.com's live calendar API.

Set these env vars:
    CAL_API_KEY        — your Cal.com API key
    CAL_EVENT_TYPE_ID  — numeric event type ID from Cal.com
"""

from loguru import logger

from calcom_client import CalcomClient
from scheduler_agent import SchedulerAgent

from smallestai.atoms.swarm.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.swarm.server import AtomsSwarmApp
from smallestai.atoms.swarm.session import SwarmSession


async def setup_session(session: SwarmSession):
    """Configure appointment scheduling session.

    Architecture:
    - CalcomClient: Live Cal.com calendar for slots + bookings
    - SchedulerAgent (OutputSwarmNode): Receptionist with calendar tools
    """

    calcom = CalcomClient()
    if not calcom.enabled:
        logger.warning(
            "[App] Cal.com not configured! Set CAL_API_KEY and CAL_EVENT_TYPE_ID. "
            "Agent will not be able to check availability or book."
        )

    agent = SchedulerAgent(calcom=calcom)
    session.add_node(agent)

    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = (
                "Hello! Welcome to Smallest Health Clinic. "
                "I'm Ria, the receptionist. "
                "Would you like to book an appointment, or check an existing one?"
            )
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsSwarmApp(setup_handler=setup_session)
    app.run()
