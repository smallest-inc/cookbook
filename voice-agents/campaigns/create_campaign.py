"""
Create Campaign Script

Creates an outbound campaign linking agent, audience, and phone numbers.

Usage:
    python create_campaign.py
"""

import os
from dotenv import load_dotenv
from smallestai import SmallestAI
from smallestai.atoms.helpers import Campaign

load_dotenv()


def main():
    """Create an outbound campaign."""
    
    # Get required IDs from environment
    agent_id = os.getenv("AGENT_ID")
    audience_id = os.getenv("AUDIENCE_ID")
    
    if not agent_id:
        print("Error: AGENT_ID not set. Create an agent first.")
        return
    
    if not audience_id:
        print("Error: AUDIENCE_ID not set. Run create_audience.py first.")
        return
    
    # Get available phone numbers
    client = SmallestAI()
    phone_numbers = client.atoms.phone_numbers.list()

    if not phone_numbers.data:
        print("Error: No phone numbers available. Acquire a number first.")
        return

    # Use the first available phone number
    phone_id = phone_numbers.data[0].id
    phone_display = phone_numbers.data[0].attributes.phone_number
    print(f"Using phone number: {phone_display}")
    
    # Create campaign
    campaign = Campaign()
    
    print("Creating campaign...")
    
    result = campaign.create(
        name="Demo Outbound Campaign",
        agent_id=agent_id,
        audience_id=audience_id,
        phone_ids=[phone_id],
        description="Demo campaign for testing",
        max_retries=3,      # Retry up to 3 times if no answer
        retry_delay=15      # Wait 15 minutes between retries
    )
    
    campaign_id = result["data"]["_id"]
    print(f"✓ Campaign created: {campaign_id}")
    
    # Save for later use
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    with open(env_path, "a") as f:
        f.write(f"CAMPAIGN_ID={campaign_id}\n")
    
    print(f"✓ CAMPAIGN_ID saved to .env")
    print(f"\nNext: Run manage_campaign.py start to start dialing")
    
    return campaign_id


if __name__ == "__main__":
    main()
