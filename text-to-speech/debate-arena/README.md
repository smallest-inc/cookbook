# The Agora — AI Philosophical Debate Arena

Socrates and Aristotle debate any modern topic with AI-generated voices, powered by [Smallest AI](https://smallest.ai) Lightning TTS v3.2 WebSocket streaming.

**Socrates** argues FOR — using the Socratic method, rhetorical questions, and passionate conviction.
**Aristotle** argues AGAINST — using logic, systematic analysis, and appeals to reason.

Each philosopher has a distinct voice with expressive parameters (emotion, pitch, volume, prosody) predicted by the LLM each round.

## Try It Live

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/smallest-inc/cookbook/tree/main/text-to-speech/debate-arena&env=SMALLEST_API_KEY,OPENAI_API_KEY&envDescription=Get%20your%20Smallest%20AI%20key%20at%20smallest.ai%20and%20OpenAI%20key%20at%20platform.openai.com&envLink=https://smallest.ai)

Or run locally:

```bash
git clone https://github.com/smallest-inc/cookbook.git
cd cookbook/text-to-speech/debate-arena
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your API keys in the browser.

## Get Your API Keys (Free)

| Key | Where to Get | What It's For |
|-----|-------------|---------------|
| **Smallest AI API Key** | [smallest.ai](https://smallest.ai) | Voice synthesis (TTS v3.2) |
| **OpenAI API Key** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Argument generation (GPT-4o-mini) |

Keys are entered directly in the browser UI — they stay in your browser and are never stored on any server.

## How It Works

1. Enter any debate topic, pick voices for each philosopher, choose 1-3 rounds
2. GPT-4o-mini generates arguments in the style of each philosopher + predicts voice parameters
3. v3.2 WebSocket streaming TTS renders both voices in parallel with expressive emotion
4. Arguments escalate: measured early, passionate/angry by the final round
5. An ancient Athenian judge scores both on Wisdom, Rhetoric, and Logic
6. Cast your own vote as a citizen of Athens

### Two Modes

- **Philosophical** — Classical rhetoric, wisdom, escalating arguments
- **Roast Battle** — Satirical wit, absurd analogies, playful insults

### Architecture

- **v3.2 WebSocket streaming** for low-latency expressive TTS (~0.3s TTFB)
- **Parallel TTS**: both voices generate simultaneously
- **Pre-fetch pipeline**: next round's LLM call starts during current audio playback
- **Web Audio API**: chunk-by-chunk playback with real-time waveform visualization + lip-sync
- **BYOK mode**: users enter their own API keys in the browser (no server env vars needed)

## Deploy

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/smallest-inc/cookbook/tree/main/text-to-speech/debate-arena&env=SMALLEST_API_KEY,OPENAI_API_KEY&envDescription=Get%20your%20Smallest%20AI%20key%20at%20smallest.ai%20and%20OpenAI%20key%20at%20platform.openai.com&envLink=https://smallest.ai)

Server env vars are optional — if not set, users must enter their own keys in the UI.

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/smallest-debate-arena?referralCode=smallest)

### Manual

```bash
npm install
npm run build
npm start
```

## Tech Stack

- **Next.js 14** — App Router
- **Tailwind CSS** — Greek philosophical theme
- **Framer Motion** — Animations
- **Web Audio API** — Streaming playback + waveform + lip-sync
- **Lightning TTS v3.2** — WebSocket streaming with expressive voice params
- **GPT-4o-mini** — Argument generation & judging

## License

MIT
