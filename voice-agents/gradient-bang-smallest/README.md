# Gradient Bang with Smallest AI STT + TTS

> **Attribution:** Gradient Bang is an open-source project created and maintained by [Pipecat AI](https://github.com/pipecat-ai). Smallest AI has no ownership of, affiliation with, or rights over the game. This cookbook is an independent integration guide showing how to use Smallest AI's STT and TTS services within the game's existing Pipecat-based architecture.

[Gradient Bang](https://github.com/pipecat-ai/gradient-bang) is an open-source online multiplayer game where players explore, trade, and battle — and every NPC, ship, and world event is driven by a real AI agent. This cookbook shows you how to swap the existing STT and TTS providers for **Smallest AI**, consolidating to a single API key, and how to run the full game stack locally with Docker and Supabase.

The result is identical gameplay, voice interaction, and interruption behavior — just powered by Smallest AI's low-latency WebSocket STT and TTS.

---

## How It Works

The Pipecat bot pipeline inside Gradient Bang looks like this:

```
Browser / Daily WebRTC
         │
         ▼
  transport.input()
         │
         ▼
 Smallest AI STT  ──►  PreLLMGate  ──►  UserAggregator  ──►  LLM (OpenAI)
                                                                    │
                              ┌─────────────────────────────────────┤
                              ▼                                     ▼
                    Main Branch                              UI Branch
             PostLLMGate → TTS Guard                 UIAgent LLM (Gemini)
                    │                                        │
                    ▼                                        ▼
           Smallest AI TTS                         UIResponseCollector
                    │
                    ▼
           transport.output()
                    │
                    ▼
         AssistantAggregator
```

The UI branch runs in parallel — a Gemini-powered agent that drives the in-game UI without producing voice output. The voice branch goes through Smallest AI STT → OpenAI LLM → Smallest AI TTS with full interruption support: if you start speaking while the bot is talking, Pipecat's `InterruptionFrame` cancels the in-flight TTS immediately.

---

## The Provider Swap — Five Files

This is the complete change needed to plug Smallest AI into Gradient Bang.

### 1. `pyproject.toml` — update the bot extras

```toml
# Before
"pipecat-ai[...,<existing-stt>,<existing-tts>,...]>=0.0.108",
"pipecat-ai-flows>=0.0.22",

# After
"pipecat-ai[smallest,daily,webrtc,silero,google,anthropic,runner]>=1.0.0",
"pipecat-ai-flows>=1.0.0",
```

### 2. `src/gradientbang/pipecat_server/bot.py` — swap imports and service init

```python
# Before
# existing STT/TTS provider imports
DEFAULT_VOICE_ID = "<existing-provider-voice-id>"

# After
from pipecat.services.smallest.stt import SmallestSTTService
from pipecat.services.smallest.tts import SmallestTTSService
DEFAULT_VOICE_ID = "sophia"  # Smallest AI voice name
```

The two startup functions that initialize STT and TTS:

```python
# After
async def _startup_init_stt(language: Language = Language.EN):
    return SmallestSTTService(
        api_key=os.getenv("SMALLEST_API_KEY"),
        settings=SmallestSTTService.Settings(language=language),
    )

async def _startup_init_tts(voice_id: str = DEFAULT_VOICE_ID, language: Language = Language.EN):
    smallest_key = os.getenv("SMALLEST_API_KEY", "")
    if not smallest_key:
        logger.warning("SMALLEST_API_KEY is not set; TTS may fail.")
    return SmallestTTSService(
        api_key=smallest_key,
        settings=SmallestTTSService.Settings(voice=voice_id, language=language),
    )
```

### 3. `src/gradientbang/pipecat_server/voices.py` — update the voice registry

Gradient Bang maps short in-game names to provider voice IDs. Replace the existing provider IDs with Smallest AI voice names from [app.smallest.ai](https://app.smallest.ai):

```python
# After (Smallest AI voice names)
VOICES = {
    "ariel":   {"voice_id": "sophia",   "language": "en"},
    "sterling":{"voice_id": "robert",   "language": "en"},
    "dani":    {"voice_id": "hannah",   "language": "en"},
    "caine":   {"voice_id": "lucas",    "language": "en"},
    "voss":    {"voice_id": "magnus",   "language": "en"},
    "gordon":  {"voice_id": "jordan",   "language": "en"},
    "priya":   {"voice_id": "sameera",  "language": "hi"},
    "lucia":   {"voice_id": "daniella", "language": "es"},
    "celeste": {"voice_id": "rachel",   "language": "en"},
    "marco":   {"voice_id": "daniel",   "language": "en"},
}
```

Browse all available voice names and previews at [app.smallest.ai](https://app.smallest.ai).

### 4. `src/gradientbang/pipecat_server/client_message_handler.py` — fix settings key

Smallest AI uses `voice` (not `voice_id`) in `TTSUpdateSettingsFrame`. Update three occurrences:

```python
# Before
TTSUpdateSettingsFrame(settings={"voice_id": voice_id})

# After
TTSUpdateSettingsFrame(settings={"voice": voice_id})
```

### 5. `env.bot.example` — replace API keys

Remove the existing provider keys and add a single Smallest AI key:

```bash
SMALLEST_API_KEY=
```

---

## Local Setup with Docker + Supabase

The full game requires four components running in parallel: **Supabase** (game server + database), **edge functions**, the **web client**, and the **bot**. Supabase runs in Docker containers managed by the Supabase CLI.

### Prerequisites

- [uv](https://docs.astral.sh/uv/) — Python package manager
- [Docker](https://docs.docker.com/get-docker/) — required by the Supabase local stack
- [Node.js 18+](https://nodejs.org/) and `pnpm` — for edge functions and web client
- A Smallest AI API key — [get one at app.smallest.ai](https://app.smallest.ai)
- An OpenAI API key — [platform.openai.com](https://platform.openai.com/api-keys)
- A Google AI key — [aistudio.google.com](https://aistudio.google.com/apikey)

### Step 1: Clone and apply the changes

```bash
git clone https://github.com/pipecat-ai/gradient-bang.git
cd gradient-bang
```

Apply the five changes described above (`pyproject.toml`, `bot.py`, `voices.py`, `client_message_handler.py`, `env.bot.example`).

### Step 2: Start Supabase

```bash
npx supabase start --workdir deployment/
```

This downloads and starts the Supabase Docker stack. Once it's running, generate your local `.env.supabase`:

```bash
tok=$(openssl rand -hex 32)
npx supabase status -o env --workdir deployment | awk -F= -v tok="$tok" '
  $1=="API_URL"           {v=$2; gsub(/"/,"",v); print "SUPABASE_URL=" v}
  $1=="ANON_KEY"          {v=$2; gsub(/"/,"",v); print "SUPABASE_ANON_KEY=" v}
  $1=="SERVICE_ROLE_KEY"  {v=$2; gsub(/"/,"",v); print "SUPABASE_SERVICE_ROLE_KEY=" v}
  END {
    print "POSTGRES_POOLER_URL=postgresql://postgres:postgres@db:5432/postgres"
    print "EDGE_API_TOKEN=" tok
  }
' > .env.supabase
```

Then run the post-start setup script and generate the world:

```bash
scripts/supabase-reset-with-cron.sh

uv run universe-bang 5000 1234
set -a && source .env.supabase && set +a
uv run -m gradientbang.scripts.load_universe_to_supabase --from-json world-data/
```

### Step 3: Create a user account

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "secret123"}'
```

Or use the Supabase Studio dashboard at http://127.0.0.1:54323.

### Step 4: Configure the bot

```bash
cp env.bot.example .env.bot
```

Edit `.env.bot` and fill in your keys:

```bash
SMALLEST_API_KEY=your-smallest-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
GOOGLE_API_KEY=your-google-ai-key-here
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<from .env.supabase>
EDGE_API_TOKEN=<from .env.supabase>
VOICE_LLM_PROVIDER=openai
VOICE_LLM_MODEL=gpt-4o
TASK_LLM_PROVIDER=openai
TASK_LLM_MODEL=gpt-4o-mini
UI_AGENT_LLM_PROVIDER=google
UI_AGENT_LLM_MODEL=gemini-2.5-flash
```

### Step 5: Run the full stack

Open four terminal windows:

```bash
# Terminal 1 — Edge functions
npx supabase functions serve --workdir deployment --no-verify-jwt --env-file .env.supabase

# Terminal 2 — Bot (WebRTC transport)
uv sync --all-groups
uv run bot

# Terminal 3 — Web client
cd client
pnpm i
pnpm run dev

# Terminal 4 — (optional) NPC agent
set -a && source .env.supabase && set +a
uv run npc-run $(uv run character-lookup "YourCharacterName") "Explore the galaxy"
```

Open **http://localhost:5173** in your browser, sign in with the account you created, create a character, and start talking.

---

## Configuration

**Required bot environment variables** (in `.env.bot`):

| Variable | Description |
|---|---|
| `SMALLEST_API_KEY` | Your Smallest AI API key — [app.smallest.ai](https://app.smallest.ai) |
| `OPENAI_API_KEY` | OpenAI API key for the voice and task LLMs |
| `GOOGLE_API_KEY` | Google AI key for the UI agent (Gemini) |
| `SUPABASE_URL` | Local: `http://127.0.0.1:54321` |
| `SUPABASE_SERVICE_ROLE_KEY` | From `npx supabase status` |
| `EDGE_API_TOKEN` | Random token shared between bot and edge functions |

**LLM configuration** (defaults work for local dev):

| Variable | Default | Description |
|---|---|---|
| `VOICE_LLM_PROVIDER` | `openai` | LLM provider for the voice agent |
| `VOICE_LLM_MODEL` | `gpt-4o` | Model for player conversations |
| `TASK_LLM_PROVIDER` | `openai` | LLM provider for background task agents |
| `TASK_LLM_MODEL` | `gpt-4o-mini` | Model for autonomous game tasks |
| `UI_AGENT_LLM_PROVIDER` | `google` | Provider for the in-game UI agent |
| `UI_AGENT_LLM_MODEL` | `gemini-2.5-flash` | Model that drives UI updates |

---

## Key Implementation

### One key for both STT and TTS

Both services share a single `SMALLEST_API_KEY` and connect over persistent WebSockets that stay open for the duration of the session:

```python
stt = SmallestSTTService(
    api_key=os.getenv("SMALLEST_API_KEY"),
    settings=SmallestSTTService.Settings(language=language),
)

tts = SmallestTTSService(
    api_key=os.getenv("SMALLEST_API_KEY"),
    settings=SmallestTTSService.Settings(voice=voice_id, language=language),
)
```

### Parallel startup

Gradient Bang initializes STT, TTS, and character identity in parallel using `asyncio.gather`, so the session is ready as fast as any single service. `SmallestSTTService` and `SmallestTTSService` plug in identically to the existing provider services from the caller's perspective.

### Interruption — unchanged

Interruption handling is entirely in Pipecat's pipeline and isn't affected by the provider swap. When `SileroVADAnalyzer` detects speech during bot output, an `InterruptionFrame` cancels the in-flight TTS and flushes the pipeline. No additional code changes needed.

### Voice registry

Gradient Bang maps short in-game character names to provider-specific voice IDs in `voices.py`. After the swap, each entry points to a Smallest AI voice name. Browse all options at [app.smallest.ai](https://app.smallest.ai).

---

## What to Try

- **Interrupt the bot mid-sentence** — start speaking while it's responding and watch the reply stop instantly
- **Swap voices** — change a voice in `voices.py` to any name from [app.smallest.ai](https://app.smallest.ai) and restart the bot
- **Run an NPC agent** — use `uv run npc-run <character-id> "explore 3 sectors"` to watch an autonomous task agent play the game
- **Try a different language** — pass `language=Language.HI` (or another supported code) to both `SmallestSTTService` and `SmallestTTSService` for Hindi, French, Spanish, and more
