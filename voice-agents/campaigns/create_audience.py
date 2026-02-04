"""
Create Audience Script

Creates an audience (contact list) for outbound campaigns.

Usage:
    python create_audience.py
"""

import os
from dotenv import load_dotenv
from smallestai.atoms import Audience

load_dotenv()


def main():
    """Create an audience with sample contacts."""
    
    audience = Audience()
    
    print("Creating audience...")
    
    # Create audience with phone numbers and optional names
    result = audience.create(
        name="Demo Campaign Audience",
        phone_numbers=[
            "+1234567890",
            "+1234567891",
            "+1234567892",
        ],
        names=[
            ("John", "Doe"),
            ("Jane", "Smith"),
            ("Bob", "Johnson"),
        ],
        description="Demo audience for testing outbound campaigns"
    )
    
    audience_id = result["data"]["_id"]
    print(f"✓ Audience created: {audience_id}")
    
    # Save for later use
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    with open(env_path, "a") as f:
        f.write(f"AUDIENCE_ID={audience_id}\n")
    
    print(f"✓ AUDIENCE_ID saved to .env")
    
    return audience_id


if __name__ == "__main__":
    main()
