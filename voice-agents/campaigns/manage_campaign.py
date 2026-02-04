"""
Campaign Management Script

Start, stop, pause, and check status of campaigns.

Usage:
    python manage_campaign.py start
    python manage_campaign.py stop
    python manage_campaign.py pause
    python manage_campaign.py status
"""

import os
import sys
from dotenv import load_dotenv
from smallestai.atoms import Campaign

load_dotenv()


def get_campaign_id():
    """Get campaign ID from environment."""
    campaign_id = os.getenv("CAMPAIGN_ID")
    if not campaign_id:
        print("Error: CAMPAIGN_ID not set. Run create_campaign.py first.")
        sys.exit(1)
    return campaign_id


def start_campaign():
    """Start the campaign."""
    campaign = Campaign()
    campaign_id = get_campaign_id()
    
    print(f"Starting campaign: {campaign_id}")
    result = campaign.start(campaign_id)
    print(f"✓ Campaign started")
    print(f"  Task ID: {result.get('data', {}).get('taskId', 'N/A')}")


def stop_campaign():
    """Stop the campaign."""
    campaign = Campaign()
    campaign_id = get_campaign_id()
    
    print(f"Stopping campaign: {campaign_id}")
    result = campaign.stop(campaign_id)
    print(f"✓ Campaign stopped")


def pause_campaign():
    """Pause the campaign."""
    campaign = Campaign()
    campaign_id = get_campaign_id()
    
    print(f"Pausing campaign: {campaign_id}")
    result = campaign.pause(campaign_id)
    print(f"✓ Campaign paused")


def get_status():
    """Get campaign status."""
    campaign = Campaign()
    campaign_id = get_campaign_id()
    
    print(f"Getting status for: {campaign_id}")
    result = campaign.get(campaign_id)
    
    data = result.get("data", {}).get("campaign", {})
    print(f"\nCampaign: {data.get('name', 'N/A')}")
    print(f"Status: {data.get('status', 'N/A')}")
    print(f"Description: {data.get('description', 'N/A')}")
    print(f"Participants: {data.get('participantsCount', 0)}")
    
    # Metrics if available
    metrics = result.get("data", {}).get("metrics", {})
    if metrics:
        print(f"\nMetrics:")
        print(f"  Total participants: {metrics.get('total_participants', 0)}")
        print(f"  Contacts called: {metrics.get('contacts_called', 0)}")
        print(f"  Contacts connected: {metrics.get('contacts_connected', 0)}")


def list_campaigns():
    """List all campaigns."""
    campaign = Campaign()
    
    print("Listing all campaigns...")
    result = campaign.list()
    
    campaigns = result.get("data", {}).get("campaigns", [])
    if not campaigns:
        print("No campaigns found.")
        return
    
    total = result.get("data", {}).get("totalCampaignCount", len(campaigns))
    print(f"\nFound {len(campaigns)} of {total} campaign(s):\n")
    for c in campaigns:
        print(f"  ID: {c.get('_id', 'N/A')}")
        print(f"  Name: {c.get('name', 'N/A')}")
        print(f"  Status: {c.get('status', 'N/A')}")
        print()


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python manage_campaign.py <command>")
        print("\nCommands:")
        print("  start   - Start the campaign")
        print("  stop    - Stop the campaign")
        print("  pause   - Pause the campaign")
        print("  status  - Get campaign status")
        print("  list    - List all campaigns")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "start":
        start_campaign()
    elif command == "stop":
        stop_campaign()
    elif command == "pause":
        pause_campaign()
    elif command == "status":
        get_status()
    elif command == "list":
        list_campaigns()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
