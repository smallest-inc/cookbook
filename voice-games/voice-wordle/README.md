# Voice Wordle

Play Wordle entirely by voice. [Pulse STT](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview) hears your spoken guess, scores it Wordle-style, and [Lightning v3.1 TTS](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1) speaks back the letter-by-letter feedback.

## Features

- Hold-to-talk mic input — say any 5-letter word, release to submit
- Duplicate-letter-safe Wordle scoring (correct / wrong-spot / absent)
- Spoken feedback per guess, plus "new game" as a voice command
- Bring-your-own-key: each player enters their own `SMALLEST_API_KEY` in the
  browser — there's no shared server-side key to configure

## Requirements

Base dependencies come from this directory's own `package.json` (this is a
JS example, not a Python one — no root `requirements.txt` involvement).

- Node.js 18+
- A Smallest API key from [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys) — entered in the browser at runtime, **not** an env var

## Usage

```bash
cd voice-games/voice-wordle
npm install
npm run dev
```

This starts two processes together (see `package.json`):
- Next.js app on **http://localhost:3050**
- A WebSocket proxy on **3051** that relays to Smallest's STT/TTS endpoints

Open http://localhost:3050, paste your Smallest API key into the landing
screen, and start guessing.

## How It Works

Browsers can neither set a custom `Authorization` header on a WebSocket
connect nor read a `.env` file, so this example uses a **per-connection auth
frame** instead of a fixed server-side key:

1. The player enters their key in the browser; it's held only in React state
   (no `localStorage`/`sessionStorage`) — reloading the tab asks again.
2. On connecting to the local proxy (`proxy.mjs`), the very first WebSocket
   message sent is `{"type":"auth","key":"<their key>"}`.
3. The proxy holds the upstream connection to Smallest open only after it
   receives that frame, using the key as `Authorization: Bearer <key>` — then
   forwards all subsequent bytes transparently in both directions.

This means one running proxy can serve many players concurrently, each
authenticated as themselves, with no key baked into the server.

If a key is rejected, the affected connection closes before streaming any
audio/transcript; the app detects that and bounces the player back to the
key screen with an explanation, instead of leaving them in a silent session.

**Production note:** the auth frame keeps the key out of `.env`, URLs, and
server logs, but the browser→proxy leg is still plain `ws://` here. Put this
behind `wss://` (TLS) before exposing it to real users — fine as-is for local
dev.

## Key Snippets

Proxy: defer the upstream connection until the client authenticates itself.

```js
// proxy.mjs
clientWs.on("message", (data, isBinary) => {
  if (!authed) {
    authed = true;
    const { type, key } = JSON.parse(data.toString());
    if (type === "auth" && key) connectUpstream(key); // opens upstream WS with Authorization: Bearer <key>
    return; // the auth frame itself is never forwarded upstream
  }
  upstreamOpen ? upstream.send(data, { binary: isBinary }) : pending.push(data);
});
```

Wordle scoring, duplicate-letter safe:

```ts
// lib/words.ts
export function scoreGuess(guess: string, answer: string): LetterStatus[] {
  // two-pass: mark exact matches first, then match remaining letters
  // against the answer's remaining letter counts
}
```

## Structure

```
voice-wordle/
├── app/
│   ├── page.tsx       # ApiKeyGate + WordleGame components
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── usePulseSTT.ts      # mic → 16kHz PCM16 → Pulse STT WebSocket
│   ├── useLightningTTS.ts  # Lightning v3.1 TTS WebSocket → live PCM playback
│   └── words.ts            # word bank, scoring, guess parsing
├── proxy.mjs           # per-connection auth-frame WS proxy (see above)
└── package.json
```

## Recommended Usage

- Reference implementation for bring-your-own-key voice apps — anywhere you
  want visitors to use their own Smallest key instead of yours
- Starting point for other voice-controlled games/UIs on Pulse STT + Lightning TTS
- For a fixed single-key setup instead (no gate screen), see
  [voice-agents/pipecat-voice-agent](../../voice-agents/pipecat-voice-agent/)
  for the more general STT+TTS-in-a-browser pattern

## Documentation

- [Pulse STT overview](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/overview)
- [Lightning v3.1 TTS API reference](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-v3.1)

## Next Steps

- Add a shareable win-streak/score display
- Deploy the proxy behind TLS and ship a hosted version
