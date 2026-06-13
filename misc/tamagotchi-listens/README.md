# Tamagotchi Listens & Speaks

> **Powered by [Pulse STT](https://smallest.ai) + [Lightning v3.1 Pro TTS](https://smallest.ai) + GPT-4o — your pocket pet finally understands you, and talks back**

Two voice demos for [gochi](https://github.com/devfolioco/gochi) — a physical tamagotchi built on an ESP32-C3 SuperMini with a 128×64 OLED screen.

| Script | What it does |
|---|---|
| `tamagotchi_listens.py` | Speak a command → gochi draws pixel art, changes expression, or scrolls text |
| `gochi_chat.py` | Ask gochi a question → it thinks, scrolls its answer on screen, **speaks it aloud**, and shows a matching face |

---

## Scripts

### `tamagotchi_listens.py` — gochi draws and reacts

Speak naturally; Pulse STT transcribes your voice, GPT-4o-mini classifies your intent, and gochi reacts on its tiny screen: changing expressions, drawing pixel art, or scrolling text — all from a single spoken command.

#### What this example demonstrates

| | |
|---|---|
| **Pulse STT transcription** | Record mic audio → WAV bytes → Pulse `transcribe_pulse` → clean text with punctuation and capitalisation. |
| **Intent routing via LLM** | GPT-4o-mini classifies the transcript into one of four action types with zero-shot JSON output. |
| **Generative pixel art** | GPT-4o writes PIL drawing code on the fly; the code is executed locally and the resulting bitmap is sent to gochi's OLED. |
| **Real-time face reactions** | Ten named expressions (`happy`, `sad`, `sleepy`, `angry`, `love`, `shy`, `dead`, …) mapped from natural language. |
| **Text scrolling** | Arbitrary messages scroll across the screen, then the pet returns to neutral. |

#### How it works

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

#### The four action types

| You say | Action | What gochi does |
|---|---|---|
| `"draw a rocket"` | `draw` | GPT generates PIL code; bitmap pushed to OLED |
| `"I'm really tired"` | `face` | Switches to the `sleepy` expression |
| `"draw a cat and I feel happy"` | `draw_and_face` | Draws the cat, then switches to `happy` |
| `"show text hello world"` | `text` | Scrolls "hello world" across the screen |

```bash
python3 tamagotchi_listens.py
```

---

### `gochi_chat.py` — gochi answers out loud

Ask gochi anything. It transcribes your question with Pulse STT, generates a short witty answer with GPT-4o-mini, scrolls that answer on the OLED, **speaks it aloud via Lightning TTS**, and then shows the matching emotion face.

#### What this example demonstrates

| | |
|---|---|
| **Pulse STT transcription** | Same record-then-transcribe pattern as `tamagotchi_listens.py`. |
| **Conversational LLM response** | GPT-4o-mini replies in character as gochi — 10 words or fewer, returning `{"answer": "...", "face": "..."}`. |
| **Lightning v3.1 Pro TTS** | REST POST to `https://api.smallest.ai/waves/v1/tts` with `model: "lightning_v3.1_pro"` → WAV audio → played with `afplay`. |
| **Simultaneous display + speech** | Answer scrolls on the OLED while audio synthesises and plays, then the emotion face appears. |

#### How it works

```
You speak
    │
    ▼
record_until_enter()        mic → int16 PCM at 16 kHz
    │
    ▼
Pulse STT                   transcribe_pulse() → your question as text
    │
    ▼
GPT-4o-mini                 SYSTEM_PROMPT + question
(ask_gochi)                 → {"answer": "Rockets! Obviously. 🚀", "face": "excited"}
    │
    ├── /text  ──► answer scrolls on OLED
    ├── speak() ──► Lightning v3.1 Pro TTS synthesises audio ──► afplay plays it
    └── /face  ──► emotion face shows ──► resets to neutral after 2 s
```

#### Lightning v3.1 Pro TTS — key call

```python
import requests

response = requests.post(
    "https://api.smallest.ai/waves/v1/tts",
    headers={
        "Authorization": f"Bearer {SMALLEST_KEY}",
        "Content-Type": "application/json",
        "Accept": "audio/wav",
    },
    json={
        "text": answer,
        "voice_id": "austin",       # male voice; change to any supported voice
        "model": "lightning_v3.1_pro",
        "sample_rate": 24000,
        "output_format": "wav",
    },
)
# write response.content to a temp WAV file, then play with afplay (macOS)
```

```bash
python3 gochi_chat.py
```

---

## Quick start

```bash
cd misc/tamagotchi-listens
cp .env.example .env
# fill in SMALLEST_API_KEY and OPENAI_API_KEY
pip install -r requirements.txt

# gochi draws and reacts to commands
python3 tamagotchi_listens.py

# gochi answers questions out loud
python3 gochi_chat.py
```

Then for either script:

1. Press **Enter** — recording starts.
2. Speak your command or question.
3. Press **Enter** again — recording stops and Pulse transcribes.
4. Watch (and listen to) gochi react.
5. **Ctrl+C** to quit (resets gochi to neutral face).

---

## Prerequisites

You need a running gochi daemon. Follow the [gochi setup guide](https://github.com/devfolioco/gochi/blob/main/HOW-TO-SETUP.md) to get the firmware flashed and the daemon running. Then verify it's up:

```bash
curl http://localhost:7474/health
# → {"connected": true, ...}
```

If you don't have hardware, both scripts still run — they print a warning and skip the HTTP calls to the daemon, so you can test the STT + TTS + routing pipeline on its own.

> **Note (`gochi_chat.py`):** audio playback uses `afplay`, which is macOS-only. On Linux, swap it for `aplay` or `ffplay`.

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SMALLEST_API_KEY` | Yes | Powers Pulse STT and Lightning v3.1 Pro TTS — get one at [smallest.ai](https://smallest.ai) |
| `OPENAI_API_KEY` | Yes | Powers the intent router (GPT-4o-mini) and the drawing code generator (GPT-4o) |

| Constant | Default | Description |
|---|---|---|
| `GOCHI_URL` | `http://localhost:7474` | Address of the gochi HTTP daemon |
| `SAMPLE_RATE` | `16000` | Mic capture rate in Hz — Pulse's recommended input rate |
| `VOICE_ID` | `austin` | Lightning v3.1 Pro voice used by `gochi_chat.py` |

### Available expressions

`angry` · `dead` · `excited` · `happy` · `love` · `neutral` · `sad` · `shy` · `sleepy` · `surprised`

---

## File map

```
misc/tamagotchi-listens/
├── README.md               ← you are here
├── tamagotchi_listens.py   ← STT → intent routing → draw / face / text
├── gochi_chat.py           ← STT → GPT answer → TTS speech + OLED display + face
├── requirements.txt
└── .env.example
```

---

## Pulse STT — key call

```python
import requests

resp = requests.post(
    "https://api.smallest.ai/waves/v1/stt/",
    headers={
        "Authorization": f"Bearer {SMALLEST_KEY}",
        "Content-Type": "application/octet-stream",
    },
    params={"model": "pulse-pro", "language": "en"},
    data=wav_bytes,         # raw WAV bytes — mono, 16 kHz, int16
    timeout=15,
)
transcript = resp.json().get("transcription", "")   # → "Draw a rocket and I feel excited."
```

Pulse also supports `emotion_detection=true` via query param — returning per-emotion float scores (happiness, sadness, anger, fear, disgust). The companion script `listen_gochi.py` in the [gochi repo](https://github.com/devfolioco/gochi) shows how to use emotion scores to drive face selection automatically, without needing the GPT router.

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
- [Lightning TTS — Quickstart](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech/lightning/quickstart)
- [Lightning TTS API Reference](https://waves-docs.smallest.ai/v4.0.0/content/api-references/lightning-tts)
- [gochi hardware + daemon setup](https://github.com/devfolioco/gochi/blob/main/HOW-TO-SETUP.md)
