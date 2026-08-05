"""Create a specialist "Agent B" for the agent-to-agent transfer example.

Agent-to-agent transfer is just a transfer whose destination is another agent's
inbound number. This script stands up that second agent: a single-prompt
specialist that greets the caller, with inbound enabled on a number you provide.

Run once, then set TRANSFER_CALL_NUMBER (in this sample's .env) to the number it
prints, and redeploy your transfer agent. Now "transfer me to a specialist" hands
the caller off to Agent B.

Env: SMALLEST_API_KEY, AGENT_B_PRODUCT_ID (telephony product id of the number
Agent B should answer on).
"""
import os

from dotenv import load_dotenv

from smallestai import SmallestAI

load_dotenv()
client = SmallestAI(api_key=os.environ["SMALLEST_API_KEY"])
product_id = os.environ.get("AGENT_B_PRODUCT_ID")
if not product_id:
    raise SystemExit("Set AGENT_B_PRODUCT_ID (the telephony product id Agent B answers on)")

resp = client.atoms.agents.create_agent(
    name="specialist-agent-b",
    workflow_type="single_prompt",
    slm_model="gpt-4o",
    global_prompt=(
        "You are a specialist support agent handling an escalated call. "
        "Greet the caller, help with their issue, and keep replies concise."
    ),
    first_message="Hello, you've reached the specialist team. How can I help?",
    allow_inbound_call=True,
    telephony_product_id=[product_id],
)
agent_b_id = str(getattr(resp, "data", resp))
number = client.atoms.agents.get_agent(id=agent_b_id).data.dict().get("phoneNumber")
print(f"Agent B created: {agent_b_id}")
print(f"Agent B answers on: {number}")
print("-> set TRANSFER_CALL_NUMBER to that number in .env, then redeploy your transfer agent.")
