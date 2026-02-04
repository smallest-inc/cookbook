"""Inbound IVR Example - Intent routing and department transfers."""

from loguru import logger

from ivr_agent import IVRAgent

from smallestai.atoms.agent.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.agent.server import AtomsApp
from smallestai.atoms.agent.session import AgentSession


async def setup_session(session: AgentSession):
    """Configure IVR agent session."""
    
    agent = IVRAgent()
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = (
                "Thank you for calling TechCorp. "
                "I can help you reach Sales, Support, Billing, or Returns. "
                "How may I direct your call?"
            )
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.wait_until_complete()
    
    # Log routing stats
    logger.info(f"Call routed to: {agent.detected_intent or 'no transfer'}")
    logger.info(f"Transfer count: {agent.transfer_count}")
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsApp(setup_handler=setup_session)
    app.run()
