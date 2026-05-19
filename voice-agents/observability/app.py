"""Observability Example — Langfuse integration via BackgroundSwarmNode.

Streams live traces, tool calls, LLM generations, and transcripts
to Langfuse — all running silently alongside the main agent.
"""

from loguru import logger

from langfuse_logger import LangfuseLogger
from support_agent import SupportAgent

from smallestai.atoms.swarm.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.swarm.server import AtomsSwarmApp
from smallestai.atoms.swarm.session import SwarmSession


async def setup_session(session: SwarmSession):
    """Configure session with Langfuse observability.

    Architecture:
    - LangfuseLogger (BackgroundSwarmNode): Streams events to Langfuse
    - SupportAgent (OutputSwarmNode): Handles conversation + tools

    Both nodes run in parallel, receiving the same events.
    """

    # Background observability node — silent, zero latency impact
    langfuse = LangfuseLogger()
    session.add_node(langfuse)

    # Main conversational agent — passes tool/LLM data to the logger
    agent = SupportAgent(langfuse=langfuse)
    session.add_node(agent)

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = (
                "Hello! I'm here to help with your order. "
                "What can I assist you with today?"
            )
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.start()
    await session.wait_until_complete()

    # Flush all Langfuse events before session ends
    summary = langfuse.get_summary()
    logger.info(f"Session summary: {summary}")
    langfuse.flush()
    logger.success("Session complete — trace available in Langfuse dashboard")


if __name__ == "__main__":
    app = AtomsSwarmApp(setup_handler=setup_session)
    app.run()
