# n8n Workflows

No-code and low-code voice automation examples using the [n8n-nodes-smallestai](https://www.npmjs.com/package/n8n-nodes-smallestai) community node.

## Installation

In your n8n instance go to **Settings → Community Nodes → Install** and search for:

```
n8n-nodes-smallestai
```

Or for self-hosted instances:

```bash
npm install n8n-nodes-smallestai
```

## Examples

| Workflow | Description |
|---|---|
| [telegram-hackernews-agent](./telegram-hackernews-agent/) | Telegram bot that fetches live Hacker News stories and replies with synthesized audio using Smallest AI TTS + STT |
| [pdf-to-podcast](./pdf-to-podcast/) | Upload a PDF via web form and receive a two-host podcast WAV in your inbox, generated with OpenAI and Smallest AI TTS |

## Links

- [Smallest AI Console](https://app.smallest.ai)
- [Smallest AI Docs](https://docs.smallest.ai)
- [n8n Community Nodes — Installation Guide](https://docs.n8n.io/integrations/community-nodes/installation/)
