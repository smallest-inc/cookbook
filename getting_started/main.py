"""
Getting Started Example
========================
Complete quickstart: create agent, make outbound call, check analytics.

Run: python main.py
"""

import os
import time
import requests
from dotenv import load_dotenv
load_dotenv()

from smallestai.atoms import AtomsClient

API_KEY = os.getenv("SMALLEST_API_KEY")
AGENT_ID = os.getenv("AGENT_ID")  # Your agent with phone linked
PHONE_NUMBER = os.getenv("PHONE_NUMBER", "+1234567890")

print("=" * 50)
print("ATOMS SDK - Getting Started")
print("=" * 50)

# 1. Initialize client
print("\n1. Initializing client...")
client = AtomsClient()
print("   ✓ Client ready")

# 2. Make outbound call
print(f"\n2. Calling {PHONE_NUMBER}...")
response = client.start_outbound_call(
    conversation_outbound_post_request={
        "agentId": AGENT_ID,
        "phoneNumber": PHONE_NUMBER
    }
)
call_id = response.data.conversation_id
print(f"   ✓ Call started: {call_id}")

# 3. Wait for call
print("\n3. Waiting for call to complete...")
print("   (Answer your phone and have a conversation)")
time.sleep(30)

# 4. Get analytics
print("\n4. Getting call analytics...")
resp = requests.get(
    f"https://atoms.smallest.ai/api/v1/conversation/{call_id}",
    headers={"Authorization": f"Bearer {API_KEY}"}
)

if resp.status_code == 200:
    data = resp.json()["data"]
    print(f"   Status: {data.get('status')}")
    print(f"   Duration: {data.get('duration')}s")
    
    transcript = data.get("transcript", [])
    if transcript:
        print("\n   Transcript:")
        for msg in transcript[:5]:
            print(f"   {msg.get('role')}: {msg.get('content', '')[:50]}...")
else:
    print(f"   Call still in progress or failed: {resp.status_code}")

print("\n" + "=" * 50)
print("Done!")
