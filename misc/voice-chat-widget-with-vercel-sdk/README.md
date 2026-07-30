# Real-time voice-chat widget — **Vercel AI SDK version**

> **Same widget as [`../voice-chat-widget/`](../voice-chat-widget/), rebuilt on the [Smallest Vercel AI provider](https://www.npmjs.com/package/smallestai-vercel-provider) + [Vercel AI SDK](https://ai-sdk.dev).**

This folder is the same chat UX as the raw-WebSocket sibling, but the STT and LLM legs go through the SDK instead of hand-rolled WebSocket and SSE plumbing. Read this folder when you want to see the cleanest production-shaped path; read the raw-WS folder when you want to see what's happening under the hood.

## What's different

| | Raw-WS version | **This version (SDK)** |
|---|---|---|
| **STT** | Hand-rolled WS hook (~120 LOC) connecting to `ws://localhost:3031/stt` (a Node proxy that injects the Bearer header) | `smallestai.transcriptionStream('pulse', {auth: 'query', ...})` — browser connects **directly** to Smallest. ~50 LOC, no proxy. Auto-reconnect on socket drops, async-iterator event consumption. |
| **LLM** | `/api/chat` route hand-parses OpenAI SSE chunks | `streamText` from `ai` with `@ai-sdk/openai-compatible` pointed at `https://api.smallest.ai/waves/v1`. One function call. |
| **TTS** | Same in both — raw WS to `wss://api.smallest.ai/waves/v1/tts/live` via `proxy.mjs` | Same. The SDK doesn't yet wrap streaming TTS (`generateSpeech` is batch only), so we keep the raw-WS path here to preserve the "audio plays while LLM is still generating" UX. |
| **Proxy** | `proxy.mjs` handles `/stt` and `/tts` | `proxy.mjs` only handles `/tts`. STT no longer needs a proxy. |
| **ITN config** | Strings, snake_case query params on the WS URL | **Booleans, camelCase**, passed as options to the SDK factory. The "must be string `'true'`" gotcha disappears. |

## ITN config — SDK style

```typescript
// lib/usePulseSTT.ts — the SDK call
const stream = smallestai.transcriptionStream("pulse", {
  apiKey,
  auth: "query",                // browser-safe demo path
  language: "en",
  encoding: "linear16",
  sampleRate: 16000,
  itnNormalize: true,           // ← boolean, not the string "true"
  finalizeOnWords: false,       // ← camelCase, not finalize_on_words
  eouTimeoutMs: 1000,           // ← number, not the string "1000"
  wordTimestamps: true,
});

await stream.connect();
stream.sendAudio(pcmChunk);     // push mic frames
stream.closeStream();           // SDK sends {"type":"close_stream"} for you
```

### Param name mapping (raw API ↔ SDK)

If you're porting from raw-WS code, the rename is mechanical:

| Raw WS query param (string) | SDK option (camelCase, real types) |
|---|---|
| `itn_normalize=true` | `itnNormalize: true` |
| `finalize_on_words=false` | `finalizeOnWords: false` |
| `eou_timeout_ms=1000` | `eouTimeoutMs: 1000` |
| `sample_rate=16000` | `sampleRate: 16000` |
| `word_timestamps=true` | `wordTimestamps: true` |
| `sentence_timestamps=true` | `sentenceTimestamps: true` |
| `redact_pii=true` | `redactPii: true` |
| `redact_pci=true` | `redactPci: true` |
| `max_words=80` | `maxWords: 80` |
| (send `{"type":"close_stream"}`) | `stream.closeStream()` |
| (send `{"type":"finalize"}`) | `stream.finalize()` |

The same ITN gotchas apply (ITN only runs on `is_final` frames, `finalize_on_words=false` is critical for clean entity context, **spoken "and" inside dollar amounts breaks the currency entity**, etc.) — see the raw-WS sibling's README for the full deep-dive. The SDK version just makes the *config* less typo-prone.

## Quick start

```bash
cd misc/voice-chat-widget-with-vercel-sdk
cp .env.example .env.local
# fill in SMALLEST_API_KEY (single key, all three services)
npm install
npm run dev
# → http://localhost:3030
```

`npm run dev` starts Next on `:3030` and the (slimmer) `proxy.mjs` on `:3031`. The proxy only handles TTS now — STT goes browser-direct via the SDK.

## How each service is reached

```
                              ┌────────────────────────────────────────────────┐
                              │                    BROWSER                     │
                              │                                                │
                              │  ┌──────────────────────────────────────────┐  │
                              │  │             React UI                     │  │
                              │  └──┬────────────────┬───────────────┬──────┘  │
                              │     │                │               │         │
                              │  ┌──▼───────────┐ ┌──▼──────────┐ ┌──▼──┐      │
                              │  │ Smallest SDK │ │ fetch       │ │ TTS │      │
                              │  │ STT stream   │ │ /api/chat   │ │ hook│      │
                              │  └──┬───────────┘ └─────┬───────┘ └──┬──┘      │
                              └─────│───────────────────│────────────│─────────┘
                                    │ wss              │ http        │ ws (proxied)
                                    │ ?auth=query      │             │
        ┌───────────────────────────│───────────────────│────────────│─────────┐
        │            NODE           │                   ▼            ▼         │
        │                           │           ┌──────────────┐ ┌──────────┐  │
        │                           │           │  Next.js     │ │ proxy.mjs│  │
        │                           │           │  /api/chat   │ │ /tts only│  │
        │                           │           │  (Vercel SDK │ │ (adds    │  │
        │                           │           │   streamText)│ │  Bearer) │  │
        │                           │           └──────┬───────┘ └─────┬────┘  │
        └───────────────────────────│──────────────────│───────────────│───────┘
                                    │                  │ POST          │ wss
                                    ▼                  ▼               ▼
            wss://api.smallest.ai/waves/v1     /waves/v1/chat/   wss://api.smallest.ai/
            /stt/live?model=pulse              completions       waves/v1/tts/live
            (Pulse STT, SDK-managed)           (Electron LLM)    (Lightning v3.1)
```

The STT leg no longer touches the local proxy — the SDK is the auth boundary. This is the biggest architectural change vs the raw-WS sibling.

## Production note — `auth: 'query'` vs `signedUrl`

We use `auth: 'query'` here for demo simplicity (the API key flows through the WS URL as `?token=…`). **This puts your long-lived `SMALLEST_API_KEY` in client-side JavaScript**, which is fine for an internal demo but not for a public app.

The production pattern in the same SDK:

```typescript
const stream = smallestai.transcriptionStream("pulse", {
  signedUrl: async () => {
    // hit your own backend, which mints a short-lived signed URL
    const r = await fetch("/api/stt-signed-url");
    const { url } = await r.json();
    return url;
  },
  language: "en",
  itnNormalize: true,
  finalizeOnWords: false,
  eouTimeoutMs: 1000,
});
```

The SDK validates the returned URL is for `api.smallest.ai` (no host substitution attacks) and refreshes it on every reconnect. Your backend keeps the long-lived key; the browser only ever sees a short-lived URL.

## File map

```
misc/voice-chat-widget-with-vercel-sdk/
├── README.md                  ← you are here
├── package.json               + smallestai-vercel-provider, ai, @ai-sdk/openai-compatible
├── proxy.mjs                  TTS-only now (STT goes through the SDK directly)
├── .env.example
│
├── app/
│   ├── page.tsx               unchanged from raw-WS sibling
│   ├── layout.tsx             unchanged
│   ├── globals.css            unchanged
│   └── api/
│       ├── chat/route.ts      Vercel AI SDK streamText (was hand-rolled SSE proxy)
│       └── key/route.ts       unchanged
│
└── lib/
    ├── usePulseSTT.ts         SDK-based (was raw WS hook)
    └── useLightningTTS.ts     unchanged — raw WS until SDK adds streaming TTS
```

## When to use which folder

- **Use this folder** when you're already on the Vercel AI SDK and want minimum lines of code. STT, LLM, and reconnect logic are off your hands. Streaming TTS is the one piece you still write yourself today.
- **Use [`../voice-chat-widget/`](../voice-chat-widget/)** when you want to understand what's happening under the SDK, or when you're not on the Vercel AI SDK stack at all.

Both folders share the same UI files and produce identical UX. The diff is purely in the data-plumbing layer.

## Endpoints used

| Endpoint | Reached via | Auth |
|---|---|---|
| `wss://api.smallest.ai/waves/v1/stt/live?model=pulse` | `smallestai.transcriptionStream` (browser-direct) | `?token=…` query param (demo) or signed URL (prod) |
| `https://api.smallest.ai/waves/v1/chat/completions` | `streamText` + `@ai-sdk/openai-compatible` (server-side) | `Authorization: Bearer` from server env |
| `wss://api.smallest.ai/waves/v1/tts/live` | Raw WS via `proxy.mjs` (server-side) | `Authorization: Bearer` from proxy env |

One `SMALLEST_API_KEY` powers all three.

## License

MIT — same as the rest of the cookbook.
