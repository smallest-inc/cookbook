# Real-time voice-chat widget

> **Powered by [Pulse STT](https://smallest.ai) + [Electron LLM](https://smallest.ai) + [Lightning v3.1 TTS](https://smallest.ai) — all three Smallest AI products in one widget**

A Next.js + React chat widget that shows what a production voice-chat UX looks like when you combine all three Smallest AI products in parallel:

- **Pulse STT** transcribes the user's voice live as they speak. Partial transcripts appear in the input box; the final transcript (with **Inverse Text Normalization** for numbers, dates, currency, phone numbers, etc.) is auto-submitted to the LLM.
- **Electron** streams a reply via the OpenAI-compatible `chat/completions` endpoint. As soon as the first sentence is complete, that sentence is flushed to TTS — we don't wait for the full reply.
- **Lightning v3.1 TTS** streams audio chunks back over WebSocket. The widget plays them gap-free via Web Audio's `AudioContext`, so the bot starts speaking while Electron is still generating.

A single `SMALLEST_API_KEY` powers all three. No other provider needed.

## What this example demonstrates

| | |
|---|---|
| **Push-to-talk mic** | Hold or click. Browser mic → 16 kHz PCM16 → Pulse WS. |
| **Live partial transcripts** | Pulse partials render in the input box as you speak. Final transcripts auto-submit. |
| **ITN on finals** | "five hundred dollars" → **$500**, "nine three eight..." → **938-860-7534**, "January fifteenth" → **January 15th**. Configured for the agentic / chat pattern recommended by Smallest's docs. |
| **Sentence-boundary TTS flush** | LLM streams tokens; we flush at `. ! ?` to TTS so audio starts before the LLM finishes. TTFB ≈ 600 ms vs. ~3 s if you wait for the full reply. |
| **Gap-free audio playback** | AudioContext schedules each PCM chunk at `currentTime + accumulatedDuration` so chunk boundaries don't click. |
| **Echo mode (optional toggle)** | Skip the LLM, pipe STT → TTS directly. Useful for benchmarking raw round-trip latency. |
| **Replay button** | Re-streams any past assistant message through Lightning. No caching — each click is a fresh TTS request. |

## Quick start

```bash
cd misc/voice-chat-widget
cp .env.example .env.local
# fill in SMALLEST_API_KEY (the single key powers STT + LLM + TTS)
npm install
npm run dev
# → http://localhost:3030
```

`npm run dev` starts two processes side-by-side via `concurrently`:

- **Next.js** on `:3030` — the UI + the LLM streaming proxy (`/api/chat`)
- **`proxy.mjs`** on `:3031` — a 90-line WebSocket proxy that bridges the browser's WS connections to Smallest's WS endpoints (injecting the `Authorization: Bearer` header that browsers can't set on their own)

Open the page, grant microphone permission, and **hold the mic button** while you speak. Release → see the transcript → hear the reply.

## Architecture

```
                                    ┌──────────────────────────────────────────────┐
                                    │                BROWSER                       │
                                    │                                              │
                                    │   ┌────────────────────────────────────┐     │
                                    │   │     React UI (app/page.tsx)        │     │
                                    │   └──┬──────────────┬───────────┬──────┘     │
                                    │      │              │           │            │
                                    │  ┌───▼───┐    ┌─────▼─────┐  ┌──▼──┐         │
                                    │  │  STT  │    │ /api/chat │  │ TTS │         │
                                    │  │ hook  │    │  fetch    │  │ hook│         │
                                    │  └───┬───┘    └─────┬─────┘  └──┬──┘         │
                                    └──────│──────────────│───────────│────────────┘
                                           │ ws://        │ http://   │ ws://
                                           │ :3031/stt    │ :3030/    │ :3031/tts
                                           │              │ api/chat  │
        ┌──────────────────────────────────│──────────────│───────────│─────────────┐
        │                  NODE            ▼              ▼           ▼             │
        │      ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐           │
        │      │   proxy.mjs     │  │  Next.js     │  │   proxy.mjs     │           │
        │      │  (adds Bearer)  │  │  /api/chat   │  │  (adds Bearer)  │           │
        │      └────────┬────────┘  └──────┬───────┘  └────────┬────────┘           │
        └───────────────│──────────────────│───────────────────│────────────────────┘
                        │ wss              │ https             │ wss
                        ▼                  ▼                   ▼
              wss://api.smallest.ai  POST https://...  wss://api.smallest.ai
              /waves/v1/pulse/        /waves/v1/chat/    /waves/v1/tts/live
              get_text                completions
              (Pulse STT)             (Electron LLM)    (Lightning v3.1)
```

Three transports for three jobs:

| Transport | Used by | Why |
|---|---|---|
| **WebSocket** (proxied) | STT, TTS | Bidirectional streams — mic audio in, audio chunks out. The proxy exists only because browsers can't set custom headers on WS handshakes; in production you'd use a signed-URL endpoint instead (see "Production" below). |
| **HTTP POST + SSE** | LLM (Electron) | OpenAI-compatible chat completions stream. No WS needed — the `stream: true` flag returns Server-Sent Events. |

---

## Inverse Text Normalization (ITN) — the deep dive

ITN is the feature that turns spoken text into written form on Pulse's final transcripts. The widget has it configured for **agentic / chat use cases**, which is the most common pattern customers get wrong.

### The four params that matter

```typescript
// lib/usePulseSTT.ts
const qs = new URLSearchParams({
  language: "en",
  encoding: "linear16",
  sample_rate: "16000",
  itn_normalize: "true",         // (1) ON SWITCH
  finalize_on_words: "false",    // (2) prevent mid-utterance fragmenting
  eou_timeout_ms: "1000",        // (3) server fallback finalizer
});

// On end-of-speech (user releases the mic), the hook sends:
ws.send(JSON.stringify({ type: "close_stream" }));  // (4) explicit flush
```

| Param | Set to | What it does |
|---|---|---|
| `itn_normalize` | **`"true"`** | The on-switch. Pulse runs ITN on every `is_final: true` transcript, converting spoken-form entities to written form. Must be the **STRING** `"true"`, not boolean — the server validates against the enum `["true","false"]`. |
| `finalize_on_words` | **`"false"`** | Disables Pulse's word-count auto-finalizer. With it on (the default), the server can finalize mid-utterance — "five hundred dollars" might get split after "five hundred", and ITN sees only "500" without the currency. Always set `"false"` for chat use cases. |
| `eou_timeout_ms` | **`"1000"`** | Server-side silence fallback. If you stop sending audio for this many ms, the server finalizes anyway. Set it **larger** than your client-side VAD threshold so the client's explicit `close_stream` always wins. |
| `close_stream` message | **send on stop** | The client's explicit "I'm done, run ITN over the whole utterance now" signal. Returns `is_final: true` + `is_last: true`, then closes the WS cleanly. |

### What it produces

Try these in the widget — hold the mic, speak, release:

| You say | What appears in the bubble |
|---|---|
| "the total is five hundred and twenty five dollars" | **the total is $525** |
| "call me at nine one zero five five five one two three four" | **call me at 910-555-1234** |
| "the meeting is on January fifteenth at three thirty p m" | **the meeting is on January 15th at 3:30 PM** |
| "send the report to john at gmail dot com" | **send the report to john@gmail.com** |
| "I live at one two three main street" | **I live at 123 Main Street** |
| "it costs three point one four percent" | **it costs 3.14%** |
| "I need a loan of six hundred dollars" | **I need a loan of $600** |
| "or in rupees, six hundred" | **or in rupees, ₹600** *(Indian currency variant)* |

### Common ITN traps (English-specific)

These are the things that look like "ITN is broken" but are configuration issues, not platform bugs. They're the most common support tickets Smallest sees.

1. **Partials show spoken form — that's by design.** ITN only runs on `is_final: true` frames. If your UI shows partials and you judge ITN by what you see *during* speech, you'll always conclude it's off. Wait for the final.
2. **`itn_normalize: true` (boolean)** is silently treated as falsy by some clients. Pass the **STRING** `"true"`.
3. **`finalize_on_words: "true"` (the default)** fragments long utterances. The single most common ITN bug. Always set `"false"` for agentic flows.
4. **`format: false` does NOT cascade to disable ITN.** It only disables punctuation/capitalization. To turn ITN off, use `itn_normalize: "false"` explicitly.
5. **`max_words` too low** forces frequent finalizes that starve ITN of context. Leave at default unless you have a specific need.
6. **`is_last` ≠ `is_final`.** Every utterance boundary fires `is_final: true`. `is_last: true` fires only after `close_stream`. Listen for both.
7. **Word timestamps collapse on ITN entities.** When "twenty five dollars" merges into "$25", the output word's timestamp spans all three source words. Don't assume 1:1 word↔timestamp mapping in downstream code.

### Pattern: client-driven finalization (what we use here)

```
1. User holds mic → start VAD (or in this demo, the user signals via button release)
2. VAD/user signals "start" → open Pulse WS with the 6 params above
3. Stream PCM16 audio frames over WS
4. User releases the mic / VAD detects silence
5. Client sends: {"type":"close_stream"}
6. Server replies with is_final:true + is_last:true (full ITN over the whole utterance)
7. Client closes the WS, hands transcript to LLM
```

This pattern is in `lib/usePulseSTT.ts:stop()` — see how we send `close_stream` and let the server close the socket instead of calling `ws.close()` ourselves.

---

## Sentence-boundary flush to TTS

In chat mode, we don't wait for the LLM to finish before starting TTS. As soon as the LLM stream emits a sentence boundary (`. ! ?`), that sentence flushes to a new Lightning WS:

```typescript
// app/page.tsx — simplified
const flusher = new SentenceFlusher();

for await (const token of llmStream) {
  appendToBubble(token);
  for (const sentence of flusher.push(token)) {
    ttsQueue.push(sentence);   // each sentence opens its own short-lived TTS WS
    pumpTTS();                 // serialized — next sentence starts when previous ends
  }
}
```

This is what makes the bot *feel* real-time — first audio plays in ~600 ms after the user finishes speaking, instead of ~3 s if you waited for the whole LLM reply.

**Critical rule:** never flush Pulse partials directly to TTS. Partials drift as Pulse refines its hypothesis ("lo there" → "hello there"). If you pipe partials into TTS, the audio stutters and repeats. Only flush stable text: STT finals, or LLM sentence boundaries.

---

## TTS WebSocket — wire format gotchas

These cost us a debug session. Documented here so they don't cost the reader one.

### `output_format` is a strict enum

```typescript
ws.send(JSON.stringify({
  voice_id: "avery",
  model: "lightning_v3.1",
  text: "hello world",
  sample_rate: 24000,
  output_format: "pcm",       // ✓ valid
  // output_format: "pcm_s16le",  ✗ INVALID — server returns {status:"error", errors:[{code:"invalid_enum_value"}]}
  add_wav_header: false,
}));
```

Valid: `wav | ulaw | alaw | pcm | mp3`. Nothing else.

### Audio comes back nested under `data.audio`

```typescript
ws.onmessage = (evt) => {
  const m = JSON.parse(evt.data);
  // Wire shape: { status: "chunk", data: { audio: "<b64 PCM>" } }
  const audioB64 = m.data?.audio;   // NOT m.audio, NOT m.data
  if (audioB64) playPCM16(audioB64);

  if (m.status === "complete") ws.close();
};
```

### Gap-free playback via AudioContext

```typescript
// lib/useLightningTTS.ts — simplified
const ctx = new AudioContext();
let nextStart = ctx.currentTime;

function playPCM16(b64) {
  const f32 = decodePCM16(b64);                   // base64 → Int16 → Float32
  const buf = ctx.createBuffer(1, f32.length, sampleRate);
  buf.copyToChannel(f32, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);

  // Schedule against the running clock, not "now" — otherwise chunks click
  const startAt = Math.max(nextStart, ctx.currentTime);
  src.start(startAt);
  nextStart = startAt + buf.duration;
}
```

If you call `src.start()` (no argument) for each chunk, browser scheduling delays between chunks become audible clicks. Always schedule against an accumulating clock.

---

## Authentication — the browser WS header problem

Both Pulse and Lightning's WS endpoints require `Authorization: Bearer <SMALLEST_API_KEY>` on the WebSocket handshake. **Browsers cannot set custom headers on WebSocket connections** (a fundamental WHATWG WebSocket API limitation).

This demo solves it with a tiny Node WS proxy (`proxy.mjs`, ~90 lines) running on `:3031`. The browser connects to the local proxy with no auth; the proxy opens the upstream connection with the Bearer header injected, then pipes frames bidirectionally.

**For production, use one of:**

1. **Signed-URL endpoint** — your backend issues a short-lived signed URL the browser uses. This is what the [Vercel AI SDK provider](https://www.npmjs.com/package/smallestai-vercel-provider) does (`signedUrl` flow in `0.6.x`).
2. **Edge-deployed proxy** — the same `proxy.mjs` pattern, but deployed as a Cloudflare Worker / Vercel Edge function. No persistent server needed.
3. **Backend orchestration** — your server holds the WS connection and forwards transcripts/audio to the browser over Server-Sent Events or a separate WS.

What you should **not** do: ship your `SMALLEST_API_KEY` in client-side JavaScript. The `/api/key` route in this demo exists only because the proxy is on localhost; in production it's an obvious credential leak.

---

## Using the Vercel AI SDK instead

If you're already on the Vercel AI SDK, swap the manual WS plumbing for [`smallestai-vercel-provider`](https://www.npmjs.com/package/smallestai-vercel-provider) (currently `0.6.2`). It exposes:

- `experimental_generateSpeech` for batch TTS (Lightning v3.1)
- `experimental_transcribe` for batch STT (Pulse, pre-recorded files)
- **`smallestai.transcriptionStream("pulse", {...})` for streaming STT** — supports all the ITN flags directly (`itnNormalize`, `finalizeOnWords`, `eouTimeoutMs`, etc.) with `auth: "query"` or `signedUrl` for browser-safe streaming
- Auto-reconnect on socket drops, microphone capture hooks, and a security-validated signed-URL flow that means **no proxy required for browser apps**

```typescript
import { smallestai } from "smallestai-vercel-provider";

const stream = smallestai.transcriptionStream("pulse", {
  language: "en",
  encoding: "linear16",
  sampleRate: 16000,
  itnNormalize: true,
  finalizeOnWords: false,
  eouTimeoutMs: 1000,
  wordTimestamps: true,
});

await stream.connect();
// stream PCM frames via stream.sendAudio(buf)
// on end-of-speech: stream.closeStream()
```

For the **streaming TTS WebSocket path** (`/waves/v1/tts/live`), as of `0.6.2` the Vercel provider supports batch TTS via `generateSpeech` but not yet the streaming WS form — for that, use the same raw WS pattern shown in this example. Streaming TTS via the Vercel provider is on the SDK roadmap.

---

## Production checklist (for the team adopting this)

- [ ] Replace the `proxy.mjs` localhost proxy with a signed-URL backend route or edge proxy. Don't ship `SMALLEST_API_KEY` to the browser.
- [ ] Add VAD (e.g., [`@ricky0123/vad-web`](https://github.com/ricky0123/vad)) so the mic auto-stops on silence — users shouldn't have to click. Set the VAD silence threshold below `eou_timeout_ms` so the client signals first.
- [ ] Handle `1008` close codes with exponential backoff + jitter — that's the family of "concurrency cap / rate limit / no entitlement" closures. Don't retry on `401/403`.
- [ ] Mute the mic input track during TTS playback, OR rely on `getUserMedia({ audio: { echoCancellation: true } })`, otherwise the bot's voice gets transcribed back as user input.
- [ ] System prompt should say "no markdown" — markdown like `**bold**` reads as "asterisk asterisk bold asterisk asterisk" through TTS.
- [ ] Log `request_id` from TTS response frames for support traceability.
- [ ] Keep one long-lived TTS WS per session if you need lower TTFB; this demo opens one per utterance for simplicity.

---

## File map

```
misc/voice-chat-widget/
├── README.md                ← you are here
├── package.json             concurrently runs Next + the proxy
├── proxy.mjs                ← the 90-line browser-WS-to-Smallest-WS bridge
├── .env.example
│
├── app/
│   ├── page.tsx             ← the chat UI + the LLM/TTS orchestration
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts    ← server proxy to Electron (POST /waves/v1/chat/completions, SSE streaming)
│       └── key/route.ts     ← returns SMALLEST_API_KEY to the browser (DEMO ONLY)
│
└── lib/
    ├── usePulseSTT.ts       ← STT hook: mic → AudioWorklet PCM16 downsampler → WS, partials/finals
    └── useLightningTTS.ts   ← TTS hook: opens WS, schedules PCM chunks on AudioContext
```

Each file is ≤ 250 lines. Read `lib/usePulseSTT.ts` first if you want to see the ITN config in context. Then `lib/useLightningTTS.ts` for the wire-format gotchas. Then `app/page.tsx` for the orchestration (sentence-boundary flush, state machine, replay).

---

## Endpoints used

| Endpoint | Purpose | Auth |
|---|---|---|
| `wss://api.smallest.ai/waves/v1/pulse/get_text` | Live STT | `Authorization: Bearer <SMALLEST_API_KEY>` |
| `wss://api.smallest.ai/waves/v1/tts/live` | Streaming TTS (Lightning v3.1) | `Authorization: Bearer <SMALLEST_API_KEY>` |
| `https://api.smallest.ai/waves/v1/chat/completions` | LLM (Electron, OpenAI-compatible) | `Authorization: Bearer <SMALLEST_API_KEY>` |

One key, three services.

## License

MIT — same as the rest of the cookbook.
