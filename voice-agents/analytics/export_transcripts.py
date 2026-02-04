"""
Export Transcripts Script

Export call transcripts to a file for analysis.

Usage:
    python export_transcripts.py --output transcripts.txt
    python export_transcripts.py --agent <agent_id> --output transcripts.txt
    python export_transcripts.py --limit 50 --output transcripts.json
"""

import os
import sys
import json
import argparse
from datetime import datetime
from dotenv import load_dotenv
from smallestai.atoms import Call

load_dotenv()


def main():
    """Export transcripts to a file."""
    
    parser = argparse.ArgumentParser(description="Export call transcripts")
    parser.add_argument("--agent", help="Filter by agent ID")
    parser.add_argument("--campaign", help="Filter by campaign ID")
    parser.add_argument("--status", default="completed", help="Filter by status (default: completed)")
    parser.add_argument("--limit", type=int, default=20, help="Number of calls to export (default: 20)")
    parser.add_argument("--output", required=True, help="Output file path")
    parser.add_argument("--format", choices=["txt", "json"], default="txt", help="Output format")
    
    args = parser.parse_args()
    
    call = Call()
    
    print(f"Fetching up to {args.limit} calls...")
    
    # Get call list
    result = call.get_calls(
        agent_id=args.agent,
        campaign_id=args.campaign,
        status=args.status,
        limit=args.limit
    )
    
    calls = result.get("data", {}).get("logs", [])
    
    if not calls:
        print("No calls found.")
        return
    
    print(f"Found {len(calls)} calls. Fetching transcripts...")
    
    transcripts = []
    
    for i, c in enumerate(calls):
        call_id = c.get("callId")
        if not call_id:
            continue
        
        # Get full call details
        details = call.get_call(call_id)
        data = details.get("data", {})
        
        transcript = data.get("transcript", [])
        
        transcripts.append({
            "call_id": call_id,
            "date": data.get("createdAt", ""),
            "duration": data.get("duration", 0),
            "from": data.get("from", ""),
            "to": data.get("to", ""),
            "transcript": transcript,
            "summary": data.get("postCallAnalytics", {}).get("summary", "")
        })
        
        print(f"  [{i+1}/{len(calls)}] {call_id}")
    
    # Write output
    output_path = args.output
    
    if args.format == "json" or output_path.endswith(".json"):
        with open(output_path, "w") as f:
            json.dump(transcripts, f, indent=2)
    else:
        with open(output_path, "w") as f:
            for t in transcripts:
                f.write("=" * 60 + "\n")
                f.write(f"Call ID: {t['call_id']}\n")
                f.write(f"Date: {t['date']}\n")
                f.write(f"Duration: {t['duration']}s\n")
                f.write(f"From: {t['from']} -> To: {t['to']}\n")
                f.write("-" * 60 + "\n")
                
                for entry in t["transcript"]:
                    role = "Agent" if entry.get("role") == "agent" else "User"
                    content = entry.get("content", "")
                    f.write(f"{role}: {content}\n")
                
                if t["summary"]:
                    f.write("-" * 60 + "\n")
                    f.write(f"Summary: {t['summary']}\n")
                
                f.write("\n")
    
    print(f"\n✓ Exported {len(transcripts)} transcripts to {output_path}")


if __name__ == "__main__":
    main()
