# Agent Configs

Best-known Atoms agent configs from sales demos, cleaned up so you can create the same agent in your own organization with one command. Each one is a prompt, a config file, and a README with how to test it and what to watch for in production.

These are not end-to-end recipes. They are the starting point a recipe or a POC builds on: the prompt, the voice and turn settings, and the post-call metrics that already worked in a demo.

## What's Here

| Agent | Direction | Languages | What it shows |
|-------|-----------|-----------|---------------|
| [credit-card-emi-hi-en](./agents/credit-card-emi-hi-en/) | Inbound | Hindi, English, mixed | Turning a card purchase into EMI: transaction choice, tenure and rate read-back, confirmation, a recorded request |
| [loan-collections-hi-en](./agents/loan-collections-hi-en/) | Outbound | Hindi, English, mixed | Business loan collections at 20+ days past due: verification, a payment date ceiling, a fixed persistence model, hardship handling, compliance metrics |

[PATTERNS.md](./PATTERNS.md) pulls out the patterns both agents use, so you can reuse them in your own prompts.

Both agents were built by Yash Ghelani for sales demos. The customers, lenders, merchants and amounts here are fictional.

## Structure

```
agent-configs/
├── README.md            this file
├── PATTERNS.md          patterns shared by the agents
├── create_agent.py      creates one new agent from a folder under agents/
├── test_call.py         one guarded test call through the collections agent you created
├── requirements.txt     smallestai 5.12 or later, pytest
├── .env.example         SMALLEST_API_KEY
├── agents/
│   ├── credit-card-emi-hi-en/   README.md, prompt.md, agent-config.json
│   └── loan-collections-hi-en/  README.md, prompt.md, agent-config.json
└── tests/               offline tests against a mock API
```

## Requirements

Base dependencies are already installed from the root
[`requirements.txt`](../../requirements.txt). These scripts need `smallestai` 5.12 or later:

```bash
uv pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `SMALLEST_API_KEY`. The key is read from the environment and never printed.

## Usage

```bash
uv run create_agent.py --list                              # the agents you can create
uv run create_agent.py loan-collections-hi-en              # dry run: checks the files, sends nothing
uv run create_agent.py loan-collections-hi-en --create     # creates one new agent in your org
```

Run `--create` once per agent. Each run makes another new agent. The new id is saved to `agents/<name>/.created_agent_id`, which git ignores.

Then open the agent in the [Atoms dashboard](https://app.smallest.ai) and talk to it with a web call or chat; the default variables fill in a fictional customer. Each agent's README lists what to try.

## How It Works

`create_agent.py` only creates. It takes no agent id, so it cannot change, publish or call an agent that already exists.

1. `client.atoms.agents.create_agent(...)` creates the agent with the voice, language, first message and call settings from `agent-config.json`
2. `agent_versioning_branches.update_draft(...)` puts `prompt.md` and the `end_call` tool on the new agent's live branch
3. `Versioning(client).publish_and_wait(...)` and `make_live(...)` publish that draft
4. `CallAnalytics().set_post_call_config(...)` adds the summary prompt and the disposition metrics

Before it sends anything it checks that every `{{variable}}` in the prompt and first message has a default, that `end_call` is present, that there are no unknown keys, and that the voice model is `waves_lightning_v3_1_pro`. Lightning v3.1 (`waves_lightning_v3_1`) retires on 30 November 2026, so the script refuses it.

## Tests

```bash
uv run pytest tests
```

All tests run offline. A mock Atoms API checks the exact requests `--create` sends, and that every request after the create touches only the new agent. Other tests check the call-hour guard in `test_call.py`, the compliance settings, and that no file has a real phone number, email address or internal id.

## Adding an Agent

1. Make a folder under `agents/` with `prompt.md`, `agent-config.json` and a `README.md` that covers the use case, how to test, and compliance notes
2. Use fictional names, numbers and brands, never a customer's
3. Put an AI disclosure in the first message
4. Run `uv run create_agent.py <name>` until the dry run is clean, then `uv run pytest tests`

## Documentation

- [Agent versioning](https://docs.smallest.ai/voice-agents/developer-guide/build/agent-crews/versioning-lifecycle)
- [Post-call metrics](https://docs.smallest.ai/voice-agents/developer-guide/operate/analytics/call-metrics)
- [Calling overview](https://docs.smallest.ai/voice-agents/developer-guide/build/calling/overview)
- [Lightning v3.1 Pro](https://docs.smallest.ai/model-cards/text-to-speech/lightning-v-3-1-pro)
- [Voice agent prompting guide](../voice_agent_prompting_guide.md)
