"""
Add Contacts to Audience Script

Add new contacts to an existing audience.

Usage:
    python add_contacts.py
"""

import os
from dotenv import load_dotenv
from smallestai.atoms import Audience

load_dotenv()


def main():
    """Add contacts to an existing audience."""
    
    audience_id = os.getenv("AUDIENCE_ID")
    if not audience_id:
        print("Error: AUDIENCE_ID not set. Run create_audience.py first.")
        return
    
    audience = Audience()
    
    print(f"Adding contacts to audience: {audience_id}")
    
    # Add new contacts
    result = audience.add_contacts(
        audience_id=audience_id,
        phone_numbers=[
            "+1234567893",
            "+1234567894",
        ],
        names=[
            ("Alice", "Williams"),
            ("Charlie", "Brown"),
        ]
    )
    
    print(f"✓ Contacts added")
    
    # Show updated member count
    members = audience.get_members(audience_id)
    total = members.get("data", {}).get("totalCount", "unknown")
    print(f"  Total members: {total}")


if __name__ == "__main__":
    main()
