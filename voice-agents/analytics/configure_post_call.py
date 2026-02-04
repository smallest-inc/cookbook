"""
Configure Post-Call Analytics Script

Set up custom summary prompts and disposition metrics for an agent.

Usage:
    python configure_post_call.py <agent_id>
    python configure_post_call.py <agent_id> --show
"""

import os
import sys
from dotenv import load_dotenv
from smallestai.atoms import Call

load_dotenv()


def show_config(agent_id: str):
    """Display current post-call configuration."""
    call = Call()
    
    print(f"Getting post-call config for agent: {agent_id}\n")
    
    result = call.get_post_call_config(agent_id)
    data = result.get("data", {})
    
    print("Current Configuration:")
    print("-" * 40)
    
    summary_prompt = data.get("summaryPrompt", "Default")
    print(f"Summary Prompt: {summary_prompt}")
    
    metrics = data.get("dispositionMetrics", [])
    if metrics:
        print(f"\nDisposition Metrics ({len(metrics)}):")
        for m in metrics:
            print(f"  - {m.get('identifier')}: {m.get('dispositionValues', {}).get('type')}")
            if m.get('choices'):
                print(f"    Choices: {', '.join(m['choices'])}")
    else:
        print("\nNo disposition metrics configured")


def configure_sample(agent_id: str):
    """Configure sample post-call analytics."""
    call = Call()
    
    print(f"Configuring post-call analytics for: {agent_id}\n")
    
    # Define custom summary prompt
    summary_prompt = """Summarize this call in 2-3 sentences, focusing on:
1. The main reason for the call
2. Whether the issue was resolved
3. Any follow-up actions needed"""
    
    # Define disposition metrics
    disposition_metrics = [
        {
            "identifier": "call_outcome",
            "dispositionMetricPrompt": "What was the outcome of this call?",
            "dispositionValues": {"type": "ENUM"},
            "choices": ["Issue Resolved", "Escalated", "Callback Requested", "No Resolution"]
        },
        {
            "identifier": "customer_sentiment",
            "dispositionMetricPrompt": "What was the customer's overall sentiment?",
            "dispositionValues": {"type": "ENUM"},
            "choices": ["Positive", "Neutral", "Negative"]
        },
        {
            "identifier": "product_mentioned",
            "dispositionMetricPrompt": "Which product was discussed?",
            "dispositionValues": {"type": "STRING"}
        },
        {
            "identifier": "requires_followup",
            "dispositionMetricPrompt": "Does this call require a follow-up?",
            "dispositionValues": {"type": "BOOLEAN"}
        }
    ]
    
    result = call.set_post_call_config(
        agent_id=agent_id,
        summary_prompt=summary_prompt,
        disposition_metrics=disposition_metrics
    )
    
    print("✓ Post-call analytics configured")
    print("\nMetrics configured:")
    for m in disposition_metrics:
        print(f"  - {m['identifier']} ({m['dispositionValues']['type']})")
    
    print("\nThese metrics will be extracted from every call transcript.")


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python configure_post_call.py <agent_id> [--show]")
        print("\nOptions:")
        print("  --show    Show current configuration only")
        print("\nExample:")
        print("  python configure_post_call.py agent_123 --show")
        print("  python configure_post_call.py agent_123")
        sys.exit(1)
    
    agent_id = sys.argv[1]
    
    if "--show" in sys.argv:
        show_config(agent_id)
    else:
        configure_sample(agent_id)


if __name__ == "__main__":
    main()
