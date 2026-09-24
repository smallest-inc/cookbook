# Compliance guard

A rule the agent cannot skip, enforced in code. This is a collections callback where the
required disclosure must be spoken before any balance is discussed. The balance tool
refuses to answer until the disclosure tool has run, so the model cannot talk its way
past it. The guard is deterministic because it lives in the tool, not the prompt.

Read `assistant.py`, the walkthrough at the top explains every part (the node, the LLM,
the tools, the guard, the transfer, and the turn loop).

## What it shows

- An SDK-native guard, no third-party dependency: `get_account_balance` returns BLOCKED
  until `give_required_disclosure` and identity verification have run.
- `@function_tool` backend calls (verify identity, balance, payment plan).
- A warm transfer to a human on dispute.

## Run

```bash
pip install -r ../requirements.txt
cp ../.env.sample .env          # set ANTHROPIC_API_KEY (this example uses Claude), or point CUSTOM_LLM_* at any OpenAI-compatible endpoint
python server.py                # terminal 1
smallestai agent-crew chat      # terminal 2
```

Say: "Yes, this is Jordan." then "My date of birth ends 0713." then "How much do I owe?"
The agent gives the disclosure first, verifies identity, then reads the balance. Ask for
"a real person" to trigger the warm transfer.

## Deploy

```bash
smallestai agent-crew init --agent-id <agent-id>
smallestai agent-crew deploy --entry-point server.py
smallestai agent-crew builds    # Make Live
```
