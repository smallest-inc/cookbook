# The Agora: AI Debate Arena

Two AI voices debate any topic, out loud, powered by [Smallest AI](https://smallest.ai) Lightning v3.1 Pro streaming TTS. Use the built-in voices, or paste your own cloned voice IDs and make your clones argue.

**Side A** argues FOR. **Side B** argues AGAINST. An ancient Athenian judge scores both, then you cast your own vote.

Live demo: [showcase.smallest.ai/projects/debate-arena](https://showcase.smallest.ai/projects/debate-arena)

## Features

- **Two modes.** Philosophical (Socrates vs Aristotle, classical rhetoric) and Roast Battle (absurd analogies, playful insults).
- **Your own cast.** Name each side and, in roast mode, add roast notes ("ships demos at 3 AM", "replies 'ok' to everything"). The arguments use them.
- **Cloned voices.** Paste a Smallest AI cloned voice ID for either side. Clone a voice from about 15 seconds of clean audio in the [Smallest AI console](https://app.smallest.ai).
- **Real interruptions.** Turn on "Let them interrupt each other" and the next speaker cuts in while the current one is still talking.
- **Live captions.** Karaoke-style captions follow the audio. The full transcript appears after the verdict.

## Run locally

```bash
git clone https://github.com/smallest-inc/cookbook.git
cd cookbook/text-to-speech/debate-arena
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your API keys in the browser, or put them in `.env.local` (see `.env.example`).

## API keys

| Key | Where to get it | Used for |
|-----|-----------------|----------|
| **Smallest AI API key** | [smallest.ai](https://smallest.ai) | Voices (Lightning v3.1 Pro) and voice cloning |
| **OpenAI API key** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Arguments and judging (GPT-4o-mini) |

Keys entered in the browser are kept in your browser and sent with each request. They are not stored on the server.

### Server keys and cloned voices

If you set `SMALLEST_API_KEY` on the server, visitors can debate without their own key using the built-in voices. Cloned voice IDs need the visitor's own Smallest key, so nobody can use your key with voices you did not approve. To let specific clones run on the server key, list them in `ALLOWED_CLONE_VOICES` (comma-separated).

## How it works

1. Pick a topic, a mode, 1 to 3 rounds, a voice (or cloned voice ID) for each side, and optionally names, roast notes and interruptions.
2. GPT-4o-mini writes both sides of the round.
3. `/api/debate/speak-stream` streams each turn from the Lightning v3.1 Pro WebSocket API to the browser as server-sent events.
4. The browser plays the audio chunk by chunk with the Web Audio API, driving the waveform, the avatar's mouth and the live captions.
5. With interruptions on, side B's audio is buffered and starts while side A is still speaking, then side A fades out mid-sentence.
6. The next round is generated while the current one plays, so rounds follow each other without a long wait.
7. The judge scores Wisdom, Rhetoric and Logic and picks a winner.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/smallest-inc/cookbook/tree/main/text-to-speech/debate-arena&env=SMALLEST_API_KEY,OPENAI_API_KEY&envDescription=Get%20your%20Smallest%20AI%20key%20at%20smallest.ai%20and%20OpenAI%20key%20at%20platform.openai.com&envLink=https://smallest.ai)

Server env vars are optional. Without them, visitors enter their own keys in the UI.

Or run it anywhere Node runs:

```bash
npm install
npm run build
npm start
```

## Tech stack

- Next.js 14 (App Router), Tailwind CSS, Framer Motion
- Web Audio API for streaming playback, waveform and lip-sync
- Smallest AI Lightning v3.1 Pro (WebSocket streaming TTS, voice cloning)
- OpenAI GPT-4o-mini for arguments and judging

## License

MIT
