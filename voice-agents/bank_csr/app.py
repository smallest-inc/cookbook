"""Bank CSR Example — End-to-end voice banking agent with real database access.

Demonstrates:
- Multi-round tool chaining (SQL query → deterministic analysis → response)
- Session-based identity verification
- Banking actions (FD create/break, TDS certificate)
- BackgroundAgentNode for compliance audit logging
- Real SQLite database with synthetic banking data
"""

from loguru import logger

from audit_logger import AuditLogger
from csr_agent import CSRAgent
from database import BankingDB

from smallestai.atoms.agent.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.agent.server import AtomsApp
from smallestai.atoms.agent.session import AgentSession


async def setup_session(session: AgentSession):
    """Configure the banking CSR session.

    Architecture:
      AuditLogger (BackgroundAgentNode) — silently logs all events
      CSRAgent    (OutputAgentNode)     — handles conversation + tools
    Both nodes receive the same events in parallel.
    """

    # Shared database — created fresh per session
    db = BankingDB()

    # Background node: audit logging
    audit = AuditLogger(db=db)

    # Main conversational agent: Rekha
    csr = CSRAgent(db=db, audit=audit)

    # Register nodes (both run in parallel)
    session.add_node(audit)
    session.add_node(csr)

    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = (
                "Namaste! Welcome to Smallest Bank. "
                "I'm Rekha, your customer support representative. "
                "How may I help you today?"
            )
            csr.context.add_message({"role": "assistant", "content": greeting})
            await csr.speak(greeting)

    await session.wait_until_complete()

    # Print audit summary at end of call
    summary = audit.get_summary()
    logger.info(f"Audit summary: {summary}")

    full_log = db.get_audit_log()
    logger.info(f"Total audit entries: {len(full_log)}")

    db.close()
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsApp(setup_handler=setup_session)
    app.run()
