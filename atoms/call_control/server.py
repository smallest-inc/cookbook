"""
Server entry point for Support Agent with call control.
Run: python server.py
"""

import os
from dotenv import load_dotenv
load_dotenv()

from agent import SupportAgent
from loguru import logger

from smallestai.atoms.agent.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.agent.server import AtomsApp
from smallestai.atoms.agent.session import AgentSession


# Configure transfer number from environment
TRANSFER_NUMBER = os.getenv("TRANSFER_NUMBER", "+1234567890")


async def setup_session(session: AgentSession):
    """Configure the support agent session."""
    agent = SupportAgent(
        name="support-agent",
        transfer_number=TRANSFER_NUMBER
    )
    session.add_node(agent)
    await session.start()

    @session.on_event("on_event_received")
    async def on_event(_, event: SDKEvent):
        logger.info(f"Event: {event.type}")
        if isinstance(event, SDKSystemUserJoinedEvent):
            await agent.speak(
                "Hello! Thank you for calling TechCo support. "
                "I'm here to help with product info, orders, or technical issues. "
                "How can I assist you today?"
            )

    await session.wait_until_complete()
    logger.success("Session complete")


if __name__ == "__main__":
    print("=" * 50)
    print("TechCo Support Agent")
    print("=" * 50)
    print(f"\nTransfer number: {TRANSFER_NUMBER}")
    print("Starting server on ws://localhost:8080/ws")
    print("Connect with: smallestai agent chat")
    print("\nTry saying:")
    print("  - 'What's my order status?'")
    print("  - 'I want to speak to a human'")
    print("  - 'Thanks, goodbye'")
    print()
    
    app = AtomsApp(setup_handler=setup_session)
    app.run()
