"""Configure the deployed agent to RECEIVE inbound calls.

Direction (inbound/outbound) is agent config, not code — the same cold/warm
transfer agent handles both. This flips the agent to accept inbound calls and
assigns a phone number to it, so anyone who dials that number reaches the agent
and can ask to be transferred.

Run once after deploying:  python enable_inbound.py
Then just CALL the number and say "transfer me to a specialist".

Env: SMALLEST_API_KEY, AGENT_ID, INBOUND_PRODUCT_ID (the telephony product id of
the number that should ring this agent).
"""
import os
from dotenv import load_dotenv
from smallestai import SmallestAI

load_dotenv()
api_key = os.environ["SMALLEST_API_KEY"]
agent_id = os.environ["AGENT_ID"]
product_id = os.environ.get("INBOUND_PRODUCT_ID") or os.environ.get("FROM_PRODUCT_ID")
if not product_id:
    raise SystemExit("Set INBOUND_PRODUCT_ID (the telephony product id to route inbound to this agent)")

client = SmallestAI(api_key=api_key)
client.atoms.agents.update_agent(
    id=agent_id,
    allow_inbound_call=True,
    telephony_product_id=[product_id],
)
print(f"Inbound enabled on agent {agent_id}; number {product_id} now rings this agent.")
print("Call that number and ask to be transferred.")
