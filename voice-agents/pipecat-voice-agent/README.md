# Pipecat Voice Agent

Smallest AI's STT and TTS are now natively integrated into [Pipecat](https://github.com/pipecat-ai/pipecat) — the open-source framework for real-time voice + AI pipelines. This example shows you how to wire them up into a fully working voice agent that runs in your browser.

Speak, and the agent responds using Smallest AI’s low-latency TTS. Start speaking again while it’s talking — the response stops mid-sentence and the agent picks up your new input immediately. Pipecat handles this natively, so there’s no need to write custom interruption logic. Voice and language are configurable via CLI flags.

---

## How It Works

```
Browser microphone
        │
        ▼
SmallWebRTCTransport (WebRTC)
        │
        ▼
Smallest AI STT  ──►  OpenAI LLM  ──►  Smallest AI TTS
                                           │
                                           ▼
                              SmallWebRTCTransport (WebRTC)
                                           │
                                           ▼
                                  Browser speaker output
```

When Silero VAD detects you speaking while the assistant is talking, Pipecat sends an `InterruptionFrame` that cancels the in-flight TTS immediately. Your speech is transcribed, sent to the LLM, and a new response begins — all within the same persistent pipeline.

---

## Setup

**Requirements**

- Python 3.10+
- A microphone — accessed directly through the browser, no system dependencies needed

**Clone the repo**

```bash
git clone https://github.com/smallest-inc/cookbook.git
cd cookbook/voice-agents/pipecat-voice-agent
```

**Install**

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.sample .env
# Edit .env and add your API keys
```

**Run**

```bash
python bot.py
```

Then open **http://localhost:7860** in your browser. Click **Connect**, allow microphone access, and start talking.

Press `Ctrl+C` to stop.

---

## Configuration

**Environment variables** (set in `.env`):

| Variable | Description |
|---|---|
| `SMALLEST_API_KEY` | Your Smallest AI API key — [get one here](https://app.smallest.ai) |
| `OPENAI_API_KEY` | Your OpenAI API key — [get one here](https://platform.openai.com/api-keys) |

**CLI flags** (optional, passed at startup):

| Flag | Default | Description |
|---|---|---|
| `--voice` | `kaitlyn` | TTS voice ID — browse voices at [app.smallest.ai](https://app.smallest.ai) |
| `--language` | `en` | Language code for STT and TTS (e.g. `hi`, `de`, `fr`) |
| `--host` | `localhost` | Host to bind the server to |
| `--port` | `7860` | Port to bind the server to |

---

## Key Implementation

### Plugging in Smallest AI STT + TTS

Both speech-to-text and text-to-speech use your single `SMALLEST_API_KEY` — no extra accounts needed. The `voice` field accepts any voice ID from [app.smallest.ai](https://app.smallest.ai):

```python
from pipecat.services.smallest.stt import SmallestSTTService
from pipecat.services.smallest.tts import SmallestTTSService

stt = SmallestSTTService(
    api_key=os.getenv("SMALLEST_API_KEY"),
    settings=SmallestSTTService.Settings(language="en"),
)

tts = SmallestTTSService(
    api_key=os.getenv("SMALLEST_API_KEY"),
    sample_rate=24000,
    settings=SmallestTTSService.Settings(
        voice="kaitlyn",
        language="en",
    ),
)
```

### The Pipeline

The full pipeline is seven stages. Order matters — each stage receives frames from the previous one:

```python
pipeline = Pipeline([
    transport.input(),       # Browser microphone input via WebRTC
    stt,                     # Speech → text (Smallest AI)
    user_aggregator,         # Accumulate user turn until VAD silence
    llm,                     # Text → response (OpenAI)
    tts,                     # Text → speech (Smallest AI)
    transport.output(),      # Browser speaker output via WebRTC
    assistant_aggregator,    # Accumulate assistant turn for context
])
```

### Interruption — Zero Custom Code

Interruption works out of the box. When `SileroVADAnalyzer` detects speech while the assistant is talking, Pipecat automatically sends an `InterruptionFrame` upstream that cancels audio playback mid-stream. The user's new speech is then transcribed by Smallest AI STT and sent to the LLM as a fresh turn.

```python
# VAD is the only config needed — interruption handling is automatic
user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
    context,
    user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
)
```

---

## What to Try

- **Interrupt mid-sentence** — start speaking while the assistant is talking; it stops immediately
- **Ask a long question** — watch the assistant respond in a continuous stream
- **Change the voice** — pass `--voice <id>` when starting, e.g. `python bot.py --voice aria`
- **Change the language** — pass `--language <code>`, e.g. `python bot.py --language hi` for Hindi
