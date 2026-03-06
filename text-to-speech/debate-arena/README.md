# The Agora — AI Philosophical Debate Arena

Socrates and Aristotle debate any modern topic with AI-generated voices, powered by [Smallest AI](https://smallest.ai) Lightning TTS v3.1 streaming.

**Socrates** argues FOR — using the Socratic method, rhetorical questions, and passionate conviction.
**Aristotle** argues AGAINST — using logic, systematic analysis, and appeals to reason.

Each philosopher has a distinct voice (user-selectable). Arguments escalate from measured positions to impassioned conclusions.

## How It Works

1. Pose a question for debate and choose voices for each philosopher
2. GPT-4o-mini generates arguments in the style of each philosopher
3. **SSE streaming TTS** renders both voices in parallel — audio plays as chunks arrive
4. An ancient Athenian judge scores both on Wisdom, Rhetoric, and Logic
5. Cast your own vote as a citizen of Athens

### Low-Latency Architecture

- **v3.1 SSE streaming** (~200ms time-to-first-byte)
- **Parallel TTS**: both voices generated simultaneously
- **Pre-fetch pipeline**: next round's LLM call starts during current audio playback
- **Web Audio API**: chunk-by-chunk playback with real-time waveform visualization

## Quick Start

```bash
cd cookbook/text-to-speech/debate-arena
npm install
```

Create `.env.local`:

```
SMALLEST_API_KEY=your-smallest-api-key
OPENAI_API_KEY=your-openai-api-key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Next.js 14** — App Router
- **Tailwind CSS** — Greek philosophical theme with warm golds and classical typography
- **Framer Motion** — Animations
- **Web Audio API** — Streaming audio playback + waveform visualization
- **Lightning TTS v3.1** — SSE streaming text-to-speech
- **GPT-4o-mini** — Philosophical argument generation & judging

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/smallest-inc/cookbook/tree/main/text-to-speech/debate-arena&env=SMALLEST_API_KEY,OPENAI_API_KEY)

## License

MIT
