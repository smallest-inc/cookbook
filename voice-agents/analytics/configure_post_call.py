"""
Configure Post-Call Analytics Script

Set up custom summary prompts and disposition metrics for an agent.

Usage:
    python configure_post_call.py <agent_id>
    python configure_post_call.py <agent_id> --show
"""

import sys
from dotenv import load_dotenv
from smallestai import SmallestAI
from smallestai.atoms.helpers import CallAnalytics

load_dotenv()


def show_config(agent_id: str):
    """Display current post-call configuration (read from the agent's resolved config)."""
    client = SmallestAI()

    print(f"Getting post-call config for agent: {agent_id}\n")

    agent = client.atoms.agents.get_agent(id=agent_id).data
    config = getattr(agent, "resolved_config", None)
    pca = getattr(config, "post_call_analytics_config", None) if config else None

    print("Current Configuration:")
    print("-" * 40)

    metrics = getattr(pca, "disposition_metrics", None) or []
    if metrics:
        print(f"Disposition Metrics ({len(metrics)}):")
        for m in metrics:
            print(f"  - {m.identifier}: {m.disposition_metric_type}")
            if getattr(m, "choices", None):
                print(f"    Choices: {', '.join(m.choices)}")
    else:
        print("No disposition metrics configured")


def configure_sample(agent_id: str):
    """Configure sample post-call analytics."""
    call = CallAnalytics()

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
            "dispositionMetricType": "ENUM",
            "choices": ["Issue Resolved", "Escalated", "Callback Requested", "No Resolution"]
        },
        {
            "identifier": "customer_sentiment",
            "dispositionMetricPrompt": "What was the customer's overall sentiment?",
            "dispositionMetricType": "ENUM",
            "choices": ["Positive", "Neutral", "Negative"]
        },
        {
            "identifier": "product_mentioned",
            "dispositionMetricPrompt": "Which product was discussed?",
            "dispositionMetricType": "STRING"
        },
        {
            "identifier": "requires_followup",
            "dispositionMetricPrompt": "Does this call require a follow-up?",
            "dispositionMetricType": "BOOLEAN"
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
        print(f"  - {m['identifier']} ({m['dispositionMetricType']})")

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
