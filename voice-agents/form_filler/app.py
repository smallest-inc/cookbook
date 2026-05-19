"""Form Filler — Voice-driven structured data collection with Jotform integration.

Demonstrates a state machine driving the conversation:
step-by-step field collection, validation, backtracking,
review, and native Jotform submission.

Set these env vars for Jotform integration:
    JOTFORM_API_KEY  — your Jotform API key
    JOTFORM_FORM_ID  — numeric form ID from the Jotform URL
"""

from loguru import logger

from form_agent import FormAgent
from form_engine import create_insurance_claim_form
from jotform_client import JotformClient

from smallestai.atoms.swarm.events import SDKEvent, SDKSystemUserJoinedEvent
from smallestai.atoms.swarm.server import AtomsSwarmApp
from smallestai.atoms.swarm.session import SwarmSession


async def setup_session(session: SwarmSession):
    """Configure form filler session.

    Architecture:
    - FormEngine: State machine with typed fields, validation, step progression
    - JotformClient: Submits completed data as native Jotform entries
    - FormAgent (OutputSwarmNode): Voice agent that follows the state machine
    """

    # Create a fresh insurance claim form for this session
    form = create_insurance_claim_form()

    # Jotform client (auto-discovers question IDs from your form)
    jotform = JotformClient()
    if jotform.enabled:
        await jotform.discover_questions()
        logger.info("[App] Jotform integration active")
    else:
        logger.info("[App] Jotform not configured — will generate local HTML only")

    # Agent driven by the form engine + Jotform
    agent = FormAgent(form=form, jotform=jotform)
    session.add_node(agent)

    await session.start()

    @session.on_event("on_event_received")
    async def on_event_received(_, event: SDKEvent):
        logger.info(f"Event received: {event.type}")

        if isinstance(event, SDKSystemUserJoinedEvent):
            greeting = (
                "Hello! Welcome to Smallest Insurance claims desk. "
                "I'm Nisha, and I'll help you file your health insurance claim. "
                "It'll take about 3 to 4 minutes. Shall we get started?"
            )
            agent.context.add_message({"role": "assistant", "content": greeting})
            await agent.speak(greeting)

    await session.wait_until_complete()

    # Log form status
    if form.state.value == "confirmed":
        logger.success(f"Form completed! Data: {form.to_json()}")
    else:
        logger.warning(f"Form not completed. State: {form.state.value}")

    logger.success("Session complete")


if __name__ == "__main__":
    app = AtomsSwarmApp(setup_handler=setup_session)
    app.run()
