"""Bank CSR Example - Multi-round tool chaining with real database access."""

from loguru import logger

from audit_logger import AuditLogger
from csr_agent import CSRAgent
from database import BankingDB

from smallestai.atoms.crew.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession


async def setup_session(session: CrewSession):
    """Configure banking CSR session.

    Architecture:
    - BankingDB: In-memory SQLite with synthetic banking data
    - AuditLogger (BackgroundCrewNode): Silent compliance logging
    - CSRAgent (OutputCrewNode): Handles conversation, verification, SQL queries,
      deterministic analysis, and banking actions via multi-round tool chaining

    Both nodes run in parallel, receiving the same events.
    """

    db = BankingDB()

    # Background audit logger — silent compliance node
    audit = AuditLogger(db=db)
    session.add_node(audit)

    # Main conversational agent
    csr = CSRAgent(db=db, audit=audit)
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

    # Log audit summary at session end
    summary = audit.get_summary()
    logger.info(f"Audit summary: {summary}")
    full_log = db.get_audit_log()
    logger.info(f"Total audit entries: {len(full_log)}")

    db.close()
    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsCrewApp(setup_handler=setup_session)
    app.run()
