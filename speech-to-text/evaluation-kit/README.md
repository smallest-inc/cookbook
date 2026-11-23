# Pulse STT Evaluation Kit

Measure how accurate Pulse speech to text is on public benchmarks, in your language, and on your own recordings, and check Pulse 2.0 latency and end-of-turn detection. Every run writes one summary table plus per-clip CSV and JSONL.

This kit was written by **Harshita Jain** at Smallest AI for customers evaluating Pulse. This recipe ports it into the cookbook with small changes listed under [Changes from the original kit](#changes-from-the-original-kit).

## Features

- **Track 1, English accuracy.** WER on the Hugging Face Open ASR Leaderboard (ESB) test sets, streamed straight from the Hub
- **Track 2, other languages.** Google FLEURS for any locale (`ko_kr`, `hi_in`, `ja_jp`, `cmn_hans_cn`, `es_419`, `de_de`, ...). CER for Korean, Japanese, Chinese and Thai, WER for the rest
- **Track 3, your own audio.** Point it at a folder of clips with `.txt` transcripts. Results are broken down per sub-folder
- **Track 4, Pulse 2.0 real-time.** Latency, end-of-turn detection rate, premature cut-offs, emotion and gender accuracy (`--model pulse-2 --eot`)
- Proper normalization before scoring: Whisper's English normalizer (the leaderboard method), plus Unicode, punctuation and native-digit handling for other scripts
- Corpus-level WER and CER with substitution, deletion and insertion counts
- `summary.md`, `summary.csv` and `summary.json` per run, `results.csv` and `results.jsonl` per dataset
- Resumable runs, `--rescore` without calling the API, and clear failure reasons in the report

## Requirements

Base dependencies are already installed from the root
[`requirements.txt`](../../requirements.txt). Additionally:

- Add `SMALLEST_API_KEY` to your `.env` (create a key at [app.smallest.ai](https://app.smallest.ai/dashboard/api-keys))
- Python 3.10+

Install example-specific dependencies:

```bash
uv pip install -r requirements.txt
```

## Usage

Smoke test on the four bundled clips (English, Hindi, Korean):

```bash
uv run run_eval.py --suite manifest --manifest fixtures/manifest.jsonl --model pulse
```

Quick check on 200 LibriSpeech clips (about 5 minutes):

```bash
uv run run_eval.py --suite esb --subset librispeech_clean --limit 200
```

### Track 1, English accuracy (ESB)

```bash
uv run run_eval.py --suite esb --model pulse --limit 500
uv run run_eval.py --suite esb --subset librispeech_clean,librispeech_other,earnings22 --limit 500
uv run run_eval.py --suite esb --model pulse-pro --limit 500     # pre-recorded endpoint
```

Subsets: `ami`, `earnings22`, `gigaspeech`, `librispeech_clean`, `librispeech_other`, `spgispeech`, `tedlium`, `voxpopuli`. TED-LIUM is not published in the Hub mirror, so the kit skips it and averages the other 7. With `--limit`, clips are sampled evenly across each set, because the Hub files are sorted by clip length and the first N would be only the longest clips.

### Track 2, Korean and other languages (FLEURS)

```bash
uv run run_eval.py --suite fleurs --locale ko_kr --model pulse
uv run run_eval.py --suite fleurs --locale hi_in,ja_jp,es_419 --model pulse --limit 200
```

Korean is scored on CER with spaces ignored, because Korean word spacing differs between annotators. FLEURS references contain digits (`2011년`); if Pulse writes a number out in words it counts as an error, so check `results.csv` when reviewing.

### Track 3, your own audio (the one that matters most)

```
my_audio/
  support_calls/clip01.wav   clip01.txt   <- reference transcript
  noisy/car/clip02.wav       clip02.txt
```

```bash
uv run make_manifest.py my_audio --language en        # sub-folders become tags
uv run run_eval.py --suite manifest --manifest my_audio/manifest.jsonl --model pulse
```

Or write `manifest.jsonl` yourself, one clip per line (see [`examples/manifest.example.jsonl`](./examples/manifest.example.jsonl)):

```json
{"audio": "audio/clip_0001.wav", "text": "Reference transcript here", "language": "en", "tags": ["group_a"]}
```

| Field | Required | Notes |
|---|---|---|
| `audio` | yes | Path, relative to the manifest or absolute. wav, flac, mp3, ogg, m4a, opus, webm |
| `text` | to score | Reference transcript. Without it the clip is transcribed but not scored |
| `language` | no | `en`, `hi`, `ko`, ... See the [Pulse model card](https://docs.smallest.ai/model-cards/speech-to-text/pulse) for codes |
| `tags` | no | Any labels. Results are broken down per tag |
| `emotion` | no | `neutral`, `happy`, `angry`, `sad`, `fear`, `disgust`, for Track 4 |
| `gender` | no | `male` or `female`, for Track 4 |

Already have a dataset in the [`benchmarks/`](../benchmarks/) layout (`audio/` plus `metadata.csv`)? Convert it:

```bash
uv run make_manifest.py path/to/data_dir --language hi --from-metadata-csv
```

Boost product names with `--param keywords=...` (format in the [API reference](https://docs.smallest.ai/api-reference/models/speech-to-text/speech-to-text)). Any other API option goes the same way, for example `--param itn_normalize=true`.

### Track 4, Pulse 2.0 real-time (end-of-turn, emotion, gender)

```bash
uv run run_eval.py --suite manifest --manifest my_audio/manifest.jsonl --model pulse-2 --eot --concurrency 2
uv run run_eval.py --suite fleurs --locale en_us --model pulse-2 --eot --limit 300 --concurrency 2
```

`--eot` streams audio at real-time speed, does not send a manual finalize, and appends 2 s of silence (`--trailing-silence`) so the built-in end-of-turn model decides when the speaker has finished. For latency only, use `--realtime` with any streaming model.

| Metric | Definition |
|---|---|
| First partial | Time from the first spoken word to the first non-empty partial transcript |
| Final after speech end | Time from when the speaker stops to the last final transcript |
| EOT detected | % of clips whose turn was closed by the end-of-turn model (`eot_finalized: true`) rather than by the end of the stream |
| Premature cut-off | % of clips where end-of-turn fired and more speech was transcribed afterwards |
| EOT delay | Time from the end of the last spoken word to the end-of-turn final |
| Emotion / gender | Accuracy and macro-F1 against the manifest labels (FLEURS has gender) on clips that returned a prediction, plus coverage |

Use clips that hold a single turn (one person speaking once), run at low concurrency with nothing else on the same key, and run from a machine close to where production traffic will run, since latency includes your network round trip. `pulse-2` is English only; the kit refuses other languages for it.

### All flags

```bash
uv run run_eval.py --help
uv run make_manifest.py --help
```

## Recommended Usage

- Before a deal or a migration, run Track 3 on 50 to 200 real recordings from the prospect's product, with human transcripts, and share `summary.md`
- Compare models on the same audio by running `--model pulse`, then `--model pulse-pro` or `--model pulse-2`, with different `--run-name`s
- Track regressions on a model update by keeping a fixed manifest and re-running it
- For quick WER and tail-latency numbers on a small English or Hindi folder without extra dependencies, see [Benchmarks](../benchmarks/)

## How It Works

1. A loader (`loaders.py`) yields clips as 16 kHz mono float32 audio. ESB and FLEURS are read as Parquet straight from the Hugging Face Hub, downloading only the row groups that hold sampled clips. Manifests are read from disk.
2. `pulse_client.py` sends each clip to Pulse. Streaming goes to `wss://api.smallest.ai/waves/v1/stt/live` in 160 ms chunks of 16-bit PCM. `pulse-pro` goes to `POST https://api.smallest.ai/waves/v1/stt/`. Network errors and 429/5xx are retried with backoff. Requests the API rejects outright (bad key, model or language not enabled) fail at once with the server's reason.
3. `scoring.py` normalizes reference and hypothesis, then computes corpus-level WER or CER with `jiwer`, so a long clip weighs more than a short one.
4. `run_eval.py` appends each clip to `results.jsonl` as it finishes, then builds the summaries. Re-running the same command skips finished clips and retries failed ones.

### Normalization

| Language | What happens before scoring |
|---|---|
| English | Whisper `EnglishTextNormalizer`: lower-case, punctuation removed, contractions expanded, spoken numbers as digits, British and American spelling unified. Words in brackets are kept |
| Everything else | Unicode NFC, lower-case, native digits mapped to 0-9 (so `२०११` equals `2011`), punctuation and symbols removed (including the Devanagari danda), combining marks kept |
| ko, ja, zh, yue, th | As above, then scored per character with spaces removed |

Script mixing is not normalized. If the reference has `पिरामिड` and Pulse writes `pyramid`, that is one word error. Force a metric with `--metric wer` or `--metric cer`.

## Structure

```
evaluation-kit/
├── run_eval.py          # entry point: runs a suite, writes results and summaries
├── make_manifest.py     # folder of audio + .txt, or benchmarks/ metadata.csv -> manifest.jsonl
├── pulse_client.py      # streaming (WebSocket) and pre-recorded (HTTP) Pulse client
├── loaders.py           # ESB, FLEURS and manifest loaders
├── scoring.py           # normalization, WER/CER, emotion and gender F1, latency and end-of-turn stats
├── fixtures/            # four public clips (LibriSpeech, FLEURS) and their manifest
├── examples/            # manifest format example
├── tests/               # offline tests, no key or network needed
├── requirements.txt
└── .env.sample
```

## Example Output

```
results/<run-name>/
  summary.md        <- the table to share
  summary.csv       <- one row per dataset and language
  summary.json
  <dataset>/
    results.csv     <- one row per clip: reference, hypothesis, error rate, latency, emotion, gender
    results.jsonl   <- the same plus every final the API returned
    summary.json
```

`summary.md` from `--suite esb --subset librispeech_clean,librispeech_other --limit 10 --model pulse`, run on 23 Nov 2026. Ten clips per set is a smoke test, not a benchmark; use `--limit 500` or more for numbers you quote.

```
# Pulse STT evaluation: esb_pulse

Model: `pulse` · mode: `streaming`

## Accuracy (lower is better)

| Dataset | Clips | Metric | Error rate | Failed |
|---|---:|---|---:|---:|
| esb/librispeech_clean (en) | 10 | WER | 0.91% | 0 |
| esb/librispeech_other (en) | 10 | WER | 0.77% | 0 |
| **ESB average (2 sets)** | | WER | **0.84%** | |
```

If the API rejects a model or language for your account, the report says so instead of failing silently:

```
## Failed clips (first reasons; re-run the same command to retry them)

- `fleurs/ko_kr`: server error: {'type': 'error', 'error_code': 'LANGUAGE_NOT_ENABLED_IN_REGION', ...}
```

Contact support@smallest.ai to enable a language in your region or Pulse 2.0 on your account.

## Tests

The tests are offline. They replace the network client with a fake, so no key is needed and nothing is sent.

```bash
uv run pytest tests -q
```

## Changes from the original kit

- Lives in the cookbook layout, runs with `uv run`, and loads `.env`
- The API key comes only from `SMALLEST_API_KEY`. The `--api-key` flag is gone so keys do not end up in shell history, and the endpoint override variables are gone so the key is only sent to `api.smallest.ai`
- Adds `results.csv` per dataset and `summary.csv` per run (cells that look like spreadsheet formulas are escaped)
- `make_manifest.py --from-metadata-csv` converts the `benchmarks/` layout
- Normalization maps native digits to ASCII for non-English scripts; `--metric` forces WER or CER
- Requests the API rejects (model or language not enabled, bad key) fail at once with the reason, and the report lists failure reasons
- A dataset that cannot be downloaded is skipped with a note instead of stopping the run
- Bundled public fixtures and offline tests

## Documentation

- [Pulse model card](https://docs.smallest.ai/model-cards/speech-to-text/pulse) (languages and benchmarks)
- [Pulse 2.0 model card](https://docs.smallest.ai/model-cards/speech-to-text/pulse-2-0) (end-of-turn, emotion, gender)
- [Realtime WebSocket quickstart](https://docs.smallest.ai/models/speech-to-text/realtime-web-socket/quickstart)
- [Response format](https://docs.smallest.ai/models/speech-to-text/realtime-web-socket/response-format)
- [Measuring latency](https://docs.smallest.ai/models/speech-to-text/benchmarks/measuring-latency)
- [API reference](https://docs.smallest.ai/api-reference/models/speech-to-text/speech-to-text)

## Next Steps

- [Benchmarks](../benchmarks/): single-file WER and tail-latency scripts
- [Customer Harness](../customer-harness/): reproduce customer failure cases with augmentation presets
- [Emotion Analyzer](../emotion-analyzer/): visualize per-utterance emotion across a conversation

Questions about the kit: open an issue on this repo or email support@smallest.ai.
