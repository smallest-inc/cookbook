# Customer STT Harness

A sandbox for playing with Smallest STT settings and presets before you wire
them into production. Point it at your own recordings, flip knobs (EOU
timeout, endpointing, keywords, ITN, word timestamps, …) or pick a preset
that matches your use case, and see exactly what the API returns.

The goal is to help you **get your integration right the first time**: dial
in the right settings for voice agents, IVR menus, or long-form dictation,
and see side-by-side how each knob and augmentation (head/tail clipping,
noise, jitter, early finalization, bad resampling) changes the transcript,
first-final latency, and duplicate-final count.

Mic → optional augmentation → Smallest STT (streaming or offline) → JSONL/CSV.

## Install

```
pip install sounddevice soundfile numpy websockets requests aiohttp
```

## Target: hosted Smallest STT by default

All clients default to the hosted Smallest STT endpoint. Export your key once
and every invocation picks it up:

```
export SMALLEST_API_KEY=sk_...

# stream_client / run_matrix → wss://api.smallest.ai/waves/v1/stt/live?model=pulse
# offline_client            → https://api.smallest.ai/waves/v1/stt/?model=pulse
```

Pass the STT model via `--model` (default `pulse`). `--api-key` beats the env
var when both are set.

### Pinning to a region (optional)

`api.smallest.ai` routes to the nearest healthy region automatically — you do
**not** need to pick one. If you'd rather pin traffic to a specific region
(for data residency, or to minimize latency to a known location), pass a
regional hostname via `--url`:

```
# Streaming (stream_client.py, run_matrix.py, live_server.py --upstream)
--url wss://api.us.smallest.ai/waves/v1/stt/live      # US
# Offline (offline_client.py)
--url https://api.us.smallest.ai/waves/v1/stt/        # US
```

You can also override `--url` to hit a local server, e.g.
`--url ws://localhost:8001/transcribe`.

## Files

| file                | purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `mic_record.py`     | record 16 kHz mono WAV from the default input                    |
| `augmentations.py`  | pure functions: clip head/tail, add noise, jitter, bad resample  |
| `stream_client.py`  | WebSocket streaming client with all knobs as CLI flags           |
| `offline_client.py` | HTTP client for `/transcribe` with the same augmentations        |
| `run_matrix.py`     | scenarios × profiles × augmentations → CSV                       |
| `live_server.py`    | local proxy that lets a browser stream mic → Smallest STT (holds key) |
| `live.html`         | browser UI: preset dropdown, all params, live transcript, latency |
| `scenarios/`        | drop WAVs here                                                   |

## Live browser mic tester

Speak into your laptop mic, watch live partials/finals from Smallest STT, and
see per-session latency numbers. The browser can't set the `Authorization`
header on a WebSocket, so `live_server.py` is a local proxy that holds the key.

```
export SMALLEST_API_KEY=sk_...
python live_server.py        # → http://localhost:8765
```

Open the URL, pick a preset (or edit any param), hit **Connect** then
**Start mic**. Presets baked in:

- `default` — server defaults, good baseline
- `voice_agent_open` — open-ended turns (support / sales)
- `voice_agent_short_reply` — yes/no/digits, tight EOU, boosted keywords
- `dictation` — long-form, loose EOU, ITN on
- `meeting_diarize` — diarize + word/sentence timestamps + cumulative transcript
- `pci_redacted_agent` — PII + PCI redaction (en/hi only)
- `keywords_demo` — biasing for Indic proper nouns
- `raw_no_formatting` — `format=false`; lowercase, no punctuation, no ITN

**Latency panel** shows: ws-connect ms, upstream-connect ms, first-audio →
first-partial, first-audio → first-final, last-audio → last-final,
finalize-button → next-final, running partial count, and avg gap between
partials. Use **Finalize turn** to simulate a per-turn boundary (WS stays
open); **Close stream** to end the session.

To pin the browser proxy to a specific region, start it with
`--upstream wss://api.<region>.smallest.ai/waves/v1/stt/live`.

## Try it: what each setting actually does

Each recipe below is a small A/B: run the "before" command, note the
transcript / latency, then run the "after" and compare. Use these as
templates for your own integration questions.

### 1. See how head-clipping deletes short utterances (and how EOU timeout fixes it)

```
python mic_record.py -o scenarios/yes.wav --seconds 2
python stream_client.py \
    --wav scenarios/yes.wav \
    --clip-head 100 \
    --eou-timeout-ms 400 \
    --verbose
# expect: empty or wrong final. Now:
python stream_client.py --wav scenarios/yes.wav --eou-timeout-ms 800 --verbose
# expect: correct "yes" final.
```

### 2. See how a client `finalize` racing the server can produce duplicate finals

```
python stream_client.py \
    --wav scenarios/open_ended_query.wav \
    --force-finalize-after 400 \
    --out-jsonl /tmp/race.jsonl
grep is_final /tmp/race.jsonl | wc -l
# > 1 means the race fires. Client code must dedup within 200ms.
```

### 3. See how keyword biasing improves proper-noun accuracy

```
python stream_client.py --wav scenarios/rahul_choudhary.wav
# often mis-transcribed. Now:
python stream_client.py \
    --wav scenarios/rahul_choudhary.wav \
    --keywords "Rahul:3,Choudhary:3,Chaudhary:3,Choudhari:3"
```

### 4. Sweep every preset × augmentation across your scenarios

```
python run_matrix.py --scenarios scenarios --profile voice_agent_short_reply
# → run_matrix_results.csv with first_final_ms, duplicate_final_count,
#   last_partial_change_after_final_ms per (scenario, augmentation).
```

## Preset profiles

Both `stream_client.py --preset <name>` and `run_matrix.py --profile <name>` accept the same preset names. A preset bundles the client-visible config knobs so you don't have to remember which combination goes with which turn distribution. Any explicit `--flag` overrides the preset.

| preset | when to use | client-visible knobs the preset sets |
|---|---|---|
| `voice_agent_open` | Support / sales agent, open-ended user turns | `eou_timeout_ms=900`, `endpointing=true`, `finalize_on_words=false`, `itn_normalize=true` |
| `voice_agent_short_reply` | Yes/no/digit/menu confirmation turns | `eou_timeout_ms=550`, `endpointing=true`, `finalize_on_words=false`, `itn_normalize=false` (short-EOU + ITN = garbage) |
| `ivr` | Telephony IVR / phone menus | `eou_timeout_ms=500`, `endpointing=true`, `finalize_on_words=false`, `itn_normalize=false`. Also implies `sample_rate=8000` + `encoding=mulaw` — supply IVR audio in that format; the harness reads `sample_rate` from the WAV. |
| `dictation` | Long-form meetings, voicemail | `eou_timeout_ms=1400`, `endpointing=false` (VAD false-fires on thinking pauses), `finalize_on_words=false`, `itn_normalize=true`, `word_timestamps=true` |

Examples:
```
# Yes/no confirmation with the reply grammar biased
python stream_client.py \
    --wav scenarios/yes.wav \
    --preset voice_agent_short_reply \
    --keywords yes:3,no:3

# Same preset but override EOU for a specific test
python stream_client.py \
    --wav scenarios/yes.wav \
    --preset voice_agent_short_reply \
    --eou-timeout-ms 400

# Run every scenario through the IVR preset
python run_matrix.py --scenarios scenarios --profile ivr
```

