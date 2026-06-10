# Tamagotchi Listens

> **Powered by [Pulse STT](https://smallest.ai) + GPT-4o — your pocket pet finally understands you**

A voice-driven demo for [gochi](https://github.com/devfolioco/gochi) — a physical tamagotchi built on an ESP32-C3 SuperMini with a 128×64 OLED screen. Speak naturally; Pulse STT transcribes your voice in real time, GPT-4o classifies your intent, and gochi reacts on its tiny screen: changing expressions, drawing pixel art, or scrolling text — all from a single spoken command.

---

## What this example demonstrates

| | |
|---|---|
| **Pulse STT transcription** | Record mic audio → WAV bytes → Pulse `transcribe_pulse` → clean text with punctuation and capitalisation. |
| **Intent routing via LLM** | GPT-4o-mini classifies the transcript into one of four action types with zero-shot JSON output. |
| **Generative pixel art** | GPT-4o writes PIL drawing code on the fly; the code is executed locally and the resulting bitmap is sent to gochi's OLED. |
| **Real-time face reactions** | Ten named expressions (`happy`, `sad`, `sleepy`, `angry`, `love`, `shy`, `dead`, …) mapped from natural language. |
| **Text scrolling** | Arbitrary messages scroll across the screen, then the pet returns to neutral. |

---

## How it works

```
You speak
    │
    ▼
record_until_enter()        mic → int16 PCM at 16 kHz
    │
    ▼
to_wav_bytes()              pack into an in-memory WAV
    │
    ▼
Pulse STT                   smallestai.waves.transcribe_pulse()
(transcribe)                → "draw a rocket and I'm excited"
    │
    ▼
GPT-4o-mini router          ROUTER_PROMPT + transcript
(route)                     → {"action":"draw_and_face","subject":"rocket","expression":"excited"}
    │
    ├── draw / draw_and_face ──► GPT-4o writes PIL code ──► rendered to 128×64 bitmap ──► /image
    ├── face               ──► expression name ──► /face
    └── text               ──► message string  ──► /text
```

### The four action types

| You say | Action | What gochi does |
|---|---|---|
| `"draw a rocket"` | `draw` | GPT generates PIL code; bitmap pushed to OLED |
| `"I'm really tired"` | `face` | Switches to the `sleepy` expression |
| `"draw a cat and I feel happy"` | `draw_and_face` | Draws the cat, then switches to `happy` |
| `"show text hello world"` | `text` | Scrolls "hello world" across the screen |

### Why Pulse for this

Pulse `transcribe_pulse` works on a short pre-recorded clip — there's no streaming WS to manage. The demo records until you press Enter, converts to WAV, and sends the whole clip in one call. This keeps the code simple and latency acceptable for a local pet demo. For a truly hands-free version (VAD + streaming), the WebSocket path (`/waves/v1/pulse/get_text`) is the right upgrade.

---

## Prerequisites

You need a running gochi daemon. Follow the [gochi setup guide](https://github.com/devfolioco/gochi/blob/main/HOW-TO-SETUP.md) to get the firmware flashed and the daemon running. Then verify it's up:

```bash
curl http://localhost:7474/health
# → {"connected": true, ...}
```

If you don't have hardware yet the script still runs — it prints a warning and skips the HTTP calls to the daemon, so you can test the STT + routing pipeline on its own.

---

## Quick start

```bash
cd misc/tamagotchi-listens
cp .env.example .env
# fill in SMALLEST_API_KEY and OPENAI_API_KEY
pip install -r requirements.txt
python3 tamagotchi_listens.py
```

Then:

1. Press **Enter** — recording starts.
2. Speak your command.
3. Press **Enter** again — recording stops and Pulse transcribes.
4. Watch gochi react.
5. **Ctrl+C** to quit (resets gochi to neutral face).

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SMALLEST_API_KEY` | Yes | Powers Pulse STT — get one at [smallest.ai](https://smallest.ai) |
| `OPENAI_API_KEY` | Yes | Powers the intent router (GPT-4o-mini) and the drawing code generator (GPT-4o) |

| Constant | Default | Description |
|---|---|---|
| `GOCHI_URL` | `http://localhost:7474` | Address of the gochi HTTP daemon |
| `SAMPLE_RATE` | `16000` | Mic capture rate in Hz — Pulse's recommended input rate |

### Available expressions

`angry` · `dead` · `excited` · `happy` · `love` · `neutral` · `sad` · `shy` · `sleepy` · `surprised`

---

## File map

```
misc/tamagotchi-listens/
├── README.md            ← you are here
├── tamagotchi_listens.py ← the full demo: STT → routing → draw / face / text
├── requirements.txt
└── .env.example
```

---

## Pulse STT — key call

```python
from smallestai import SmallestAI

client = SmallestAI(api_key=SMALLEST_KEY)
result = client.waves.transcribe_pulse(
    request=wav_bytes,      # raw WAV bytes — mono, 16 kHz, int16
    language="en",
    punctuate="true",       # adds full stops, commas, etc.
    capitalize="true",      # capitalises proper nouns and sentence starts
)
transcript = result.transcription   # → "Draw a rocket and I feel excited."
```

Pulse also supports `emotion_detection="true"` — returning per-emotion float scores (happiness, sadness, anger, fear, disgust). The companion script `listen_gochi.py` in the [gochi repo](https://github.com/devfolioco/gochi) shows how to use emotion scores to drive face selection automatically, without needing the GPT router.

---

## Generative pixel art — how the drawing pipeline works

```
"draw a rocket"
      │
      ▼
GPT-4o (DRAW_PROMPT)
      │  writes raw PIL code, e.g.:
      │    draw.polygon([(64,4),(74,40),(54,40)], outline=WHITE)
      │    draw.rectangle([58,40,70,55], outline=WHITE)
      │    ...
      ▼
code_to_bitmap(code)
      │  exec()s the code on a 128×64 monochrome PIL Image
      │  serialises pixel data into a 1024-byte buffer
      │  base64-encodes it
      ▼
POST http://localhost:7474/image  {"data": "<base64>"}
      │
      ▼
gochi OLED
```

GPT-4o is given a tightly scoped system prompt: only PIL drawing primitives, exact canvas dimensions, and monochrome constraints. This reliably produces runnable code for recognisable pixel art even on a 128×64 canvas.

---

## API reference

- [Pulse STT — Pre-recorded Quickstart](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/pre-recorded/quickstart)
- [Pulse STT API Reference](https://waves-docs.smallest.ai/v4.0.0/content/api-references/pulse-asr)
- [gochi hardware + daemon setup](https://github.com/devfolioco/gochi/blob/main/HOW-TO-SETUP.md)
