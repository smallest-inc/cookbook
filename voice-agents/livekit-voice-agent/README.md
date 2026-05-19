# LiveKit Voice Agent

A real-time voice agent built with [LiveKit Agents](https://docs.livekit.io/agents/) and [Smallest AI](https://smallest.ai) for both speech-to-text and text-to-speech. Speak to it, and it responds using Smallest AI's low-latency Lightning TTS. Start speaking mid-response — it stops immediately and picks up your new input. Connect from anywhere using the LiveKit Agents Playground.

---

## How It Works

```
Your microphone
      │
      ▼
LiveKit Room (WebRTC)
      │
      ▼
Silero VAD  ──►  Smallest AI STT (Pulse)  ──►  OpenAI LLM  ──►  Smallest AI TTS (Lightning)
                                                                         │
                                                                         ▼
                                                              LiveKit Room (WebRTC)
                                                                         │
                                                                         ▼
                                                                  Your speaker
```

The pipeline is fully interruptible. When Silero VAD detects speech while the agent is talking, the in-flight TTS is cancelled immediately, the new speech is transcribed by Smallest AI STT, and a fresh LLM response begins — all without any custom logic.

---

## Setup

**Requirements:** Python 3.10+ and a [LiveKit Cloud](https://cloud.livekit.io) project.

**Clone the repo**

```bash
git clone https://github.com/smallest-inc/cookbook.git
cd cookbook/voice-agents/livekit-voice-agent
```

**Install dependencies**

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

**Configure environment**

```bash
cp .env.sample .env
# Edit .env and fill in all API keys
```

**Run the agent**

```bash
python agent.py dev
```

The `dev` flag connects the worker to your LiveKit project in development mode. You'll see a log line confirming the connection.

**Connect to the agent**

Open the [LiveKit Agents Playground](https://agents-playground.livekit.io) and enter your `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. Click **Connect** — the agent will greet you and start listening.

---

## Configuration

**Required environment variables** (set in `.env`):

| Variable | Description |
|---|---|
| `LIVEKIT_API_KEY` | Your LiveKit project API key |
| `LIVEKIT_API_SECRET` | Your LiveKit project API secret |
| `LIVEKIT_URL` | Your LiveKit WebSocket URL (e.g. `wss://your-project.livekit.cloud`) |
| `SMALLEST_API_KEY` | Your Smallest AI API key — [get one here](https://waves.smallest.ai) |
| `OPENAI_API_KEY` | Your OpenAI API key — [get one here](https://platform.openai.com/api-keys) |

**Optional overrides** (set in `.env` or export before running):

| Variable | Default | Description |
|---|---|---|
| `VOICE_ID` | `sophia` | TTS voice ID — browse all voices at [waves.smallest.ai](https://waves.smallest.ai) |
| `LANGUAGE` | `en` | BCP-47 language code for STT and TTS. Use `multi` for automatic detection across 39 languages |
| `LLM_MODEL` | `gpt-4o-mini` | OpenAI model name |

---

## Key Implementation

### Smallest AI STT — Pulse

Real-time transcription over WebSocket with ~64ms TTFT. Set `language="multi"` to let the model detect the speaker's language automatically:

```python
stt=smallestai.STT(language="en")
```

### Smallest AI TTS — Lightning

The Lightning TTS plugin synthesizes audio per sentence rather than streaming tokens, so it is wrapped in `tts.StreamAdapter` with a `SentenceTokenizer`. The adapter buffers LLM output to the next sentence boundary before firing synthesis — keeping first-audio latency low while the LLM is still generating:

```python
tts=tts.StreamAdapter(
    tts=smallestai.TTS(
        model="lightning-v3.1",
        voice_id="sophia",
        language="en",
    ),
    sentence_tokenizer=tokenize.basic.SentenceTokenizer(),
)
```

### Interruption — Zero Custom Code

The `CrewSession` handles interruptions automatically. When Silero VAD detects you speaking mid-response, the TTS stream is cancelled and your speech is processed as a new turn.

---

## What to Try

- **Interrupt mid-sentence** — start speaking while the agent is talking; it stops immediately
- **Switch to Hindi** — set `LANGUAGE=hi` in `.env` and restart
- **Change the voice** — set `VOICE_ID=<id>` in `.env` (browse voices at [waves.smallest.ai](https://waves.smallest.ai))
- **Try multilingual detection** — set `LANGUAGE=multi` and speak in any of the 39 supported languages
