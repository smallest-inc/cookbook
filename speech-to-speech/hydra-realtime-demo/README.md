# Hydra Realtime Demo

A reference web client for **Smallest.ai's Hydra** — a full-duplex speech-to-speech model. You stream microphone audio in, Hydra streams spoken response audio back. Built with Next.js 15, React 19, and Tailwind.

Talk to Hydra in your browser, watch every WebSocket frame as it lands, and switch between multi-agent presets that wire up client-side tools.

> Source repository: [smallest-inc/hydra_agents](https://github.com/smallest-inc/hydra_agents). This copy lives in the cookbook so the S2S examples sit next to the STT/TTS ones; the upstream repo is the canonical home.

---

## What this demo does

- **WebSocket voice loop** — 16 kHz PCM16 mic → Hydra → streamed PCM16 audio back, gapless playback.
- **Wire-log tab** — every `session.*`, `input_audio_buffer.*`, `response.*`, `conversation.item.*`, and `error` event, in & out, with a JSON inspector.
- **Multi-agent presets** — a friendly companion, a burger-restaurant phone agent (`Smallest Kitchen`), and a banking concierge (`NovaBank`). All tools execute locally — Hydra is a pure voice engine.
- **Beautiful, audio-reactive orb** that pulses with the live RMS level of whichever side is currently active.
- **Persona / voice editing** — change the system prompt, pick from six Hydra voices, toggle whether the agent speaks first.
- **Zero server** — connects browser → Hydra directly. Your API key never leaves your browser.

---

## Connecting

Hydra production endpoint:

```
wss://api.smallest.ai/waves/v1/s2s?model=hydra&api_key=<SMALLEST_API_KEY>
```

The demo appends `?api_key=…` itself; paste just the key in the right-hand panel.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Then in the right panel:

1. Paste your `SMALLEST_API_KEY`.
2. (Optionally) override the WebSocket URL.
3. Pick a preset on the left rail.
4. Click **Connect**.

Your key is persisted to `localStorage` so you only have to enter it once per browser.

---

## Wire protocol — at a glance

Every frame is JSON. Events are discriminated by `type`. See the [Hydra docs](https://docs.smallest.ai/waves/documentation/speech-to-speech-hydra/managing-sessions) for the full event reference.

### Handshake

```
ws open
  ← { "type": "session.created", "session_id": "…" }
  → { "type": "session.configure", "session": {
        "instructions": "you are a friendly voice assistant.",
        "voice": "aria",
        "tools": [],
        "generate_initial_response": false
      }}
  ← { "type": "session.configured", "session": {
        "voice": "aria",
        "input_audio_format": "pcm16",
        "input_audio_sample_rate": 16000,
        "output_audio_format": "pcm16",
        "output_audio_sample_rate": 24000,
        ...
      }}
```

The handshake is one-shot. After `session.configured`, the server accepts audio.

### Streaming audio (both directions)

```
→ { "type": "input_audio_buffer.append", "audio": "<base64 PCM16 @ 16kHz>" }

← { "type": "input_audio_buffer.speech_started", "audio_start_ms": 1840, "item_id": "item_…" }
← { "type": "conversation.item.added", "item": { "id": "item_…", "role": "user", ... } }
← { "type": "input_audio_buffer.speech_stopped", "audio_end_ms": 4120, "item_id": "item_…" }
← { "type": "conversation.item.done", "item": { ..., "status": "completed", "content": [{"type":"input_audio","text":"…asr…"}] } }

← { "type": "response.created", "response": { "id": "resp_…", "status": "in_progress" } }
← { "type": "conversation.item.added", "item": { "id": "item_…", "role": "assistant" } }
← { "type": "response.output_audio.delta", "response_id": "resp_…", "item_id": "item_…", "delta": "<base64 PCM16>" }
…
← { "type": "response.output_audio.done", "response_id": "resp_…", "item_id": "item_…" }
← { "type": "response.done", "response": { "id": "resp_…", "status": "completed", "usage": {...} } }
```

### Tool calls (client-side execution)

Hydra emits the tool call; the client executes it locally and posts the result back.

```
← { "type": "response.function_call_arguments.delta", "call_id": "call_…", "name": "get_menu", "delta": "{\"cate" }
← { "type": "response.function_call_arguments.done", "call_id": "call_…", "name": "get_menu", "arguments": "{\"category\":\"burgers\"}" }

→ { "type": "conversation.item.create", "item": {
      "type": "function_call_output",
      "call_id": "call_…",
      "output": "Smallest Kitchen menu: ..."
    }}
→ { "type": "response.create" }
```

### Mid-session updates

```
→ { "type": "session.update", "session": { "tools": [ ... ] } }
← { "type": "session.updated", "session": { "tools": [ ... ] } }
```

Today only `tools` is honoured mid-session. The persona / voice are locked in by the initial `session.configure`.

### Barge-in / cancel

If the user starts speaking while Hydra is responding, the server emits `input_audio_buffer.speech_started` and the response will land as:

```
← { "type": "response.done", "response": {
      "id": "resp_…",
      "status": "cancelled",
      "status_details": { "reason": "interrupted" }
    }}
```

Programmatic cancel:

```
→ { "type": "response.cancel" }
← { "type": "response.done", "response": { "status": "cancelled",
                                            "status_details": { "reason": "client_cancelled" } } }
```

### Errors

```
← { "type": "error", "error": {
      "type": "invalid_request_error",
      "code": "invalid_audio",
      "message": "audio frame too small (40 bytes, need 320)"
    }}
```

Codes: `invalid_request_error`, `invalid_audio`, `invalid_frame`, `tool_response_timeout`, `server_full`, `internal_error`.

---

## Project layout

```
src/app/
├── App.tsx                      ← shell: topbar, agent rail, orb, transcript, events, panel
├── page.tsx, layout.tsx, globals.css
├── types.ts                     
├── lib/
│   ├── hydra-client.ts          ← thin WebSocket wrapper
│   └── audio.ts                 ← mic worklet + gapless playback
├── hooks/
│   └── useHydraSession.ts       ← drives the whole session state machine
├── components/
│   ├── Orb.tsx                  ← audio-reactive central orb
│   ├── Topbar.tsx               ← status pill + connect / disconnect / mute
│   ├── AgentRail.tsx            ← preset picker
│   ├── ControlPanel.tsx         ← persona / voice / API key editor
│   ├── Transcript.tsx           ← conversation bubbles with inline tool cards
│   └── EventsLog.tsx            ← live wire log with JSON inspector
├── agents/presets.ts            ← demo agent bundles (persona + tools)
└── tools/                       ← client-side tool executors (kitchen, bank)
```

The implementation deliberately stays in ~1.5k lines of TypeScript so you can read the whole thing in one sitting and lift bits into your own client.

---

## Hosting your own client

The demo is a pure static Next.js app — no backend. To deploy:

```bash
npm run build
# any static host (Vercel, Cloudflare Pages, Netlify, S3+CloudFront…)
```

## License

MIT — go build cool things with realtime voice.
