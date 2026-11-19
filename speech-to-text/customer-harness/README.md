# Customer STT Harness

A sandbox for playing with Smallest STT settings and presets before you wire
them into production. Point it at your own recordings, flip knobs (EOU
timeout, endpointing, keywords, ITN, word timestamps, and so on) or pick a preset
that matches your use case, and see exactly what the API returns.

The goal is to help you **get your integration right the first time**: dial
in the right settings for voice agents, IVR menus, or long-form dictation,
and see side-by-side how each knob and augmentation (head/tail clipping,
noise, jitter, early finalization, bad resampling) changes the transcript,
first-final latency, and duplicate-final count.

Mic or WAV, then optional augmentation, then Smallest STT (streaming or offline), then JSONL or CSV.

## Install

```
pip install sounddevice soundfile numpy websockets requests aiohttp
```

## Target: hosted Smallest STT by default

All clients default to the hosted Smallest STT endpoint. Export your key once
and every invocation picks it up:

```
export SMALLEST_API_KEY=sk_...

# stream_client / run_matrix: wss://api.smallest.ai/waves/v1/stt/live?model=pulse
# offline_client:             https://api.smallest.ai/waves/v1/stt/?model=pulse
```

Pass the STT model via `--model` (default `pulse`). The key is read from the
`SMALLEST_API_KEY` environment variable only. There is no `--api-key` flag,
because command-line arguments show up in `ps` output and shell history.
The clients also refuse to send the key over plain `ws://` or `http://` to
anything other than localhost.

### Pinning to a region (optional)

`api.smallest.ai` routes to the nearest healthy region automatically, so you do
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
| `live_server.py`    | local proxy that lets a browser stream mic audio to Smallest STT (holds the key) |
| `live.html`         | browser UI: preset dropdown, all params, live transcript, latency |
| `presets.json`      | the one preset definition shared by the CLI tools and the browser UI |
| `generate_scenarios.py` | synthesize the starter scenario WAVs with Smallest TTS        |
| `scenarios/`        | drop WAVs here (git-ignored)                                     |

## Get some audio first

A fresh clone has no WAVs in `scenarios/`, so `run_matrix.py` has nothing to
run. Either record your own with `mic_record.py` (see `scenarios/README.md`)
or generate the starter set with TTS:

```
python generate_scenarios.py      # writes scenarios/yes.wav, no.wav, ... (16 kHz mono)
```

Synthetic speech is cleaner than real callers, so use these to check the
harness works, then switch to real recordings for tuning. `scenarios/*.wav`
is git-ignored so customer audio does not end up in a commit.

## Live browser mic tester

Speak into your laptop mic, watch live partials/finals from Smallest STT, and
see per-session latency numbers. The browser can't set the `Authorization`
header on a WebSocket, so `live_server.py` is a local proxy that holds the key.

```
export SMALLEST_API_KEY=sk_...
python live_server.py        # serves http://localhost:8765
```

Open the URL, pick a preset (or edit any param), hit **Connect** then
**Start mic**. The dropdown is loaded from `presets.json`:

- `default`: server defaults, good baseline
- `voice_agent_open`: open-ended turns (support or sales)
- `voice_agent_short_reply`: yes/no/digits, tight EOU, boosted keywords
- `ivr`: phone menus, tight EOU, digits boosted
- `dictation`: long-form, loose EOU, ITN on
- `meeting_diarize`: diarize, word and sentence timestamps, cumulative transcript
- `pci_redacted_agent`: PII and PCI redaction (en/hi only)
- `keywords_demo`: bias a single proper-noun spelling
- `raw_no_formatting`: `format=false`, so lowercase, no punctuation, no ITN

The proxy only accepts `/ws` connections from its own page. It checks the
browser's `Origin` header and, by default, allows only
`http://localhost:<port>`, `http://127.0.0.1:<port>` and `http://[::1]:<port>`.
Any other site you have open in the browser gets a 403, so it cannot use your
key through the proxy. If you open the page under a different hostname, allow
it explicitly:

```
python live_server.py --allowed-origin http://mybox.local:8765
# or: HARNESS_ALLOWED_ORIGINS=http://mybox.local:8765 python live_server.py
```

**Latency panel** shows: speech end to final (the headline number), ws-connect
ms, upstream-connect ms, last audio to last final, partial count and final
count. Use **Finalize turn** to simulate a per-turn boundary (WS stays
open); **Close stream** to end the session.

To pin the browser proxy to a specific region, start it with
`--upstream wss://api.<region>.smallest.ai/waves/v1/stt/live`.

## Try it: what each setting actually does

Each recipe below is a small A/B: run the "before" command, note the
transcript / latency, then run the "after" and compare. Use these as
templates for your own integration questions.

### 1. See how head-clipping and a short EOU timeout affect short utterances

```
python mic_record.py -o scenarios/yes.wav --seconds 2
python stream_client.py \
    --wav scenarios/yes.wav \
    --clip-head 100 \
    --eou-timeout-ms 400 \
    --verbose
# Compare with:
python stream_client.py --wav scenarios/yes.wav --eou-timeout-ms 800 --verbose
```

What to look for: the number of finals and their text. In our runs the
clipped, short-EOU version usually still produced the right "yes", sometimes
followed by an extra empty final. Your client should ignore empty finals
rather than treat them as a turn. Results depend on the recording, so run it
on your own audio.

### 2. See what an early client `finalize` does to an utterance

```
python stream_client.py \
    --wav scenarios/open_ended_query.wav \
    --force-finalize-after 400 \
    --out-jsonl /tmp/race.jsonl
grep '"is_final": true' /tmp/race.jsonl
```

A `finalize` sent while the user is still talking cuts the utterance at that
point. In our runs this split the sentence into two finals: a truncated first
one (for example "Please c") and the rest in a second final. So "more than one
final" here means truncation, not a duplicate of the same text. Only send
`finalize` when your own turn detection says the user is done, and join the
finals of a turn rather than keeping only the first.

### 3. Try keyword biasing on a proper noun

```
python stream_client.py --wav scenarios/rahul_choudhary.wav
# Then bias the one spelling you want back:
python stream_client.py \
    --wav scenarios/rahul_choudhary.wav \
    --keywords "Choudhary:3"
```

Boost only the spelling you want. Listing several spellings of the same name
at the same weight (for example `Choudhary:3,Chaudhary:3,Choudhari:3`) makes
them compete, so none of them wins. Biasing is a nudge, not a guarantee: on
some recordings, including synthetic TTS clips, the output does not change.
Check it on real caller audio before relying on it.

### 4. Sweep every preset × augmentation across your scenarios

```
python run_matrix.py --scenarios scenarios --profile voice_agent_short_reply
# → run_matrix_results.csv with first_final_ms, duplicate_final_count,
#   last_partial_change_after_final_ms per (scenario, augmentation).
```

## Preset profiles

All presets are defined once, in `presets.json`. `stream_client.py --preset <name>`, `run_matrix.py --profile <name>` and the browser dropdown all read that file, so a preset means the same thing everywhere. A preset bundles the client-visible config knobs so you don't have to remember which combination goes with which turn distribution. Any explicit `--flag` overrides the preset, and `--keywords` replaces the preset's keywords. `run_matrix.py --profile all` runs the four presets below.

| preset | when to use | client-visible knobs the preset sets |
|---|---|---|
| `voice_agent_open` | Support or sales agent, open-ended user turns | `eou_timeout_ms=900`, `endpointing=true`, `finalize_on_words=false`, `itn_normalize=true`, `word_timestamps=true` |
| `voice_agent_short_reply` | Yes/no/digit/menu confirmation turns | `eou_timeout_ms=550`, `endpointing=true`, `finalize_on_words=false`, `itn_normalize=false` (ITN can rewrite one-word replies), `word_timestamps=true`, keywords for yes/no/one to five |
| `ivr` | Telephony IVR, phone menus | `eou_timeout_ms=500`, `endpointing=true`, `finalize_on_words=false`, `itn_normalize=false`, `word_timestamps=true`, keywords for digits, star and pound. The preset does not change sample rate or encoding: the harness sends whatever rate the WAV has, as `linear16`. |
| `dictation` | Long-form meetings, voicemail | `eou_timeout_ms=1400`, `endpointing=true`, `finalize_on_words=false`, `itn_normalize=true`, `word_timestamps=true`. Turning endpointing off made segmentation worse in our tests. |

## Known issues

- ITN on partials: with `itn_normalize=true`, numbers in partial transcripts can
  change form as more audio arrives: spelled out in one partial and normalized
  to digits in a later partial or the final. Read numbers from finals only.
- `run_matrix.py` gives each run `--timeout` seconds (default 60). A run that
  exceeds it is written as a row with `exit_code=timeout` and the sweep
  continues.

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

