"""
Get Call Details Script

Retrieve detailed information about a specific call including transcript.

Usage:
    python get_call_details.py <call_id>
"""

import os
import sys
from dotenv import load_dotenv
from smallestai.atoms import Call

load_dotenv()


def main():
    """Get detailed information about a call."""
    
    if len(sys.argv) < 2:
        print("Usage: python get_call_details.py <call_id>")
        print("Example: python get_call_details.py CALL-1768155029217-0bae45")
        sys.exit(1)
    
    call_id = sys.argv[1]
    
    call = Call()
    
    print(f"Fetching details for: {call_id}\n")
    
    result = call.get_call(call_id)
    data = result.get("data", {})
    
    # Basic info
    print("=" * 60)
    print("CALL DETAILS")
    print("=" * 60)
    print(f"Call ID:      {data.get('callId', 'N/A')}")
    print(f"Status:       {data.get('status', 'N/A')}")
    print(f"Type:         {data.get('type', 'N/A')}")
    print(f"Duration:     {data.get('duration', 0)} seconds")
    print(f"From:         {data.get('from', 'N/A')}")
    print(f"To:           {data.get('to', 'N/A')}")
    print(f"Agent ID:     {data.get('agentId', 'N/A')}")
    print(f"Campaign ID:  {data.get('campaignId', 'N/A') or 'None'}")
    
    # Cost
    cost = data.get("callCost", 0)
    if cost:
        print(f"\nCost:         ${cost:.4f}")
    
    # Recording URLs
    print("\n" + "=" * 60)
    print("RECORDINGS")
    print("=" * 60)
    recording = data.get("recordingUrl")
    recording_dual = data.get("recordingDualUrl")
    
    if recording:
        print(f"Recording:      {recording}")
    if recording_dual:
        print(f"Stereo:         {recording_dual}")
    if not recording and not recording_dual:
        print("No recordings available")
    
    # Transcript
    print("\n" + "=" * 60)
    print("TRANSCRIPT")
    print("=" * 60)
    transcript = data.get("transcript", [])
    
    if transcript:
        for entry in transcript:
            role = entry.get("role", "unknown")
            content = entry.get("content", "")
            role_display = "Agent" if role == "agent" else "User"
            print(f"{role_display}: {content}")
    else:
        print("No transcript available")
    
    # Post-call analytics (if available)
    analytics = data.get("postCallAnalytics", {})
    if analytics:
        print("\n" + "=" * 60)
        print("POST-CALL ANALYTICS")
        print("=" * 60)
        
        summary = analytics.get("summary")
        if summary:
            print(f"Summary: {summary}")
        
        disposition = analytics.get("disposition", {})
        if disposition:
            print("\nDisposition Metrics:")
            for key, value in disposition.items():
                print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
