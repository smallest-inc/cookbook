# Latency Waterfall

Where does the time go in one voice agent turn? This script measures it.

It streams a spoken question into Pulse STT at real time, the way a microphone would. The first final transcript goes to Electron. The first full sentence of the reply goes to Lightning v3.1 Pro. Every step is timestamped on one clock, starting from the moment you stopped talking.

```
10 of 10 runs, median per stage, ms after you stopped talking

Pulse: waiting to be sure you stopped  ███████████████████████                     718
Electron: first token                                         ████████             236
Electron: first full sentence                                         ███          103
Lightning: first audio                                                   █████     158
total to first audio                                                              1230

58% of the wait is end-of-turn detection. Network round trip: 8 ms.
```

## Features

- **Real-time streaming.** Audio goes to Pulse in 20 ms frames at real speed, so endpointing is measured the way a live call sees it.
- **One clock for every stage.** Speech end, final transcript, first LLM token, first sentence, first TTS audio.
- **Behaves like a live agent.** The first final transcript starts the reply, even if you're still talking. Shorten `--eou` and you can watch it cut you off.
- **Warm connections.** Pulse, Electron and Lightning connections are opened before you speak, as a running agent keeps them.
- **Many runs, median reported.** Every run is saved to `runs.json` with its full event log and the agent's reply audio.

## Requirements

> Make sure you've run `uv venv && uv pip install -r requirements.txt` at the repo root first. See the [main README](../../README.md#usage).

One key runs all three models:

```
SMALLEST_API_KEY=sk_...
```

## Usage

```bash
uv pip install -r requirements.txt

# No recording? Lightning speaks the question for you.
uv run measure.py --say "Hey, can you move my dentist appointment to Friday afternoon?"

# Better: record yourself asking one question (any sample rate, mono or stereo).
uv run measure.py --wav question.wav --runs 10

# Print the waterfall
uv run report.py runs/runs.json
```

### Options

| Flag | Default | What it does |
|------|---------|--------------|
| `--wav` / `--say` | | Your recording, or text for Lightning to speak |
| `--runs` | `10` | How many turns to measure |
| `--eou` | server default | Pulse `eou_timeout_ms`: how long to wait after you stop before finalizing |
| `--system` | demo receptionist | System prompt for the agent |
| `--llm` | `electron` | Model name on the Smallest chat completions endpoint |
| `--out` | `runs` | Output folder |

### Try a shorter end-of-turn wait

```bash
uv run measure.py --wav question.wav --runs 5 --eou 300 --out runs_300
uv run report.py runs_300/runs.json
```

If your question has a pause in it ("Hey, ... can you move my appointment?"), a short wait finalizes the first part on its own. The agent answers "Hey." and talks over the rest of your question. That trade-off is the core of turn-taking: wait longer and every reply is slower, wait less and the agent interrupts people who pause.

## What each stage means

| Stage | Starts | Ends |
|-------|--------|------|
| Pulse: waiting to be sure you stopped | Your last word | Final transcript arrives |
| Electron: first token | Transcript sent | First token streams back |
| Electron: first full sentence | First token | First `.`, `!` or `?` after 3+ words |
| Lightning: first audio | Sentence sent | First audio chunk arrives |

The total is from your last word to the first audio chunk of the reply. Playback buffering on a real device adds a little on top.

## Output

`runs.json` holds every run: stage timings, the full event log (partial and final transcripts, VAD events, LLM and TTS milestones), what the agent heard before replying, the reply text, and the network round trip to the API. `reply_NN.wav` is the agent's reply for each run.

## Key Snippets

### Stream at real time

```python
for k, i in enumerate(range(0, len(pcm), n)):
    delay = t0 + k * FRAME - time.perf_counter()
    if delay > 0:
        await asyncio.sleep(delay)
    await stt.send(pcm[i : i + n].tobytes())
```

### Electron is OpenAI-compatible

```python
oai = AsyncOpenAI(api_key=os.environ["SMALLEST_API_KEY"], base_url="https://api.smallest.ai/waves/v1")
stream = await oai.chat.completions.create(model="electron", stream=True, messages=[...])
```

### Send the first sentence to TTS early

```python
m = SENTENCE_END.search(buf, sent)
if sent == 0 and m and len(buf[: m.end()].split()) >= 3:
    await tts.send(json.dumps({"text": buf[: m.end()], "voice_id": TTS_VOICE, "model": TTS_MODEL}))
    await tts.send(json.dumps({"flush": True}))
```
