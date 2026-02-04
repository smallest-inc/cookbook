"""
Get Call Logs Script

Retrieve and display call history with filtering.

Usage:
    python get_calls.py
    python get_calls.py --agent <agent_id>
    python get_calls.py --status completed
    python get_calls.py --limit 20
"""

import os
import sys
import argparse
from datetime import datetime
from dotenv import load_dotenv
from smallestai.atoms import Call

load_dotenv()


def format_duration(seconds):
    """Format duration in human-readable format."""
    if not seconds:
        return "N/A"
    minutes = int(seconds) // 60
    secs = int(seconds) % 60
    return f"{minutes}m {secs}s"


def format_timestamp(timestamp_str):
    """Format timestamp for display."""
    if not timestamp_str:
        return "N/A"
    try:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except:
        return timestamp_str[:16]


def main():
    """Get and display call logs."""
    
    parser = argparse.ArgumentParser(description="Get call logs")
    parser.add_argument("--agent", help="Filter by agent ID")
    parser.add_argument("--campaign", help="Filter by campaign ID")
    parser.add_argument("--status", help="Filter by status (completed, failed, in_progress)")
    parser.add_argument("--type", help="Filter by type (telephony_inbound, telephony_outbound, chat)")
    parser.add_argument("--search", help="Search by call ID, from, or to number")
    parser.add_argument("--limit", type=int, default=10, help="Number of results (default: 10)")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    
    args = parser.parse_args()
    
    call = Call()
    
    print("Fetching call logs...")
    
    result = call.get_calls(
        agent_id=args.agent,
        campaign_id=args.campaign,
        status=args.status,
        call_type=args.type,
        search=args.search,
        limit=args.limit,
        page=args.page
    )
    
    calls = result.get("data", {}).get("logs", [])
    total = result.get("data", {}).get("pagination", {}).get("total", len(calls))
    
    if not calls:
        print("No calls found.")
        return
    
    print(f"\nShowing {len(calls)} of {total} calls (page {args.page}):\n")
    print("-" * 80)
    
    for c in calls:
        call_id = c.get("callId", "N/A")
        status = c.get("status", "N/A")
        duration = format_duration(c.get("duration"))
        call_type = c.get("type", "N/A")
        from_num = c.get("from", "N/A")
        to_num = c.get("to", "N/A")
        created = format_timestamp(c.get("createdAt"))
        
        print(f"Call ID:   {call_id}")
        print(f"Status:    {status}")
        print(f"Type:      {call_type}")
        print(f"Duration:  {duration}")
        print(f"From:      {from_num}")
        print(f"To:        {to_num}")
        print(f"Date:      {created}")
        print("-" * 80)


if __name__ == "__main__":
    main()
