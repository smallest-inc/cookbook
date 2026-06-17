# Pulse STT — Benchmarking Scripts

Self-contained reference scripts for measuring Pulse STT **accuracy** (Word Error Rate) and **latency** against your own evaluation dataset. Use these as a starting point for vendor comparisons or regression testing on a model upgrade.

Both scripts are single-file, no imports from this repo. Copy either one anywhere and run.

## Scripts

| Script | Endpoint | Reports |
|---|---|---|
| [`ping_pulse_offline.py`](./ping_pulse_offline.py) | `POST /waves/v1/stt/` (pre-recorded HTTP) | WER (corpus-level), per-clip latency, RTF (real-time factor) at p50 / p90 / p95 |
| [`ping_pulse_streaming.py`](./ping_pulse_streaming.py) | `WSS /waves/v1/stt/live` (real-time WebSocket) | WER (corpus-level), tail latency at p50 / p90 / p95 |

For the methodology behind each metric — what tail latency means, how RTF is computed, which transcripts to sample from — see the [Measuring Latency docs page](https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/benchmarks/measuring-latency).

## Quick start — using the bundled samples

The repo ships with two small ready-to-run sample datasets under `samples/`:

| Dataset | Clips | Source |
|---|---|---|
| `samples/english_samples/` | 20 clips | English read speech, FLEURS-style |
| `samples/hindi_samples/` | 10 clips | Hindi read speech, Devanagari transcripts |

```bash
# 1. Install dependencies (one time)
pip install jiwer tqdm numpy librosa websockets
# If you'll evaluate English audio:
pip install whisper-normalizer

# 2. Set your API key
export SMALLEST_API_KEY=sk_your_key_here

# 3. Run against the bundled samples
python ping_pulse_offline.py   samples/english_samples --language en --model pulse-pro
python ping_pulse_streaming.py samples/hindi_samples   --language hi
```

For a quick sanity check, the offline run on the bundled English samples typically reports corpus WER ~4-5% with Pulse Pro; streaming on the Hindi samples reports tail latency p50 around 240-300 ms.

## Run against your own dataset

```bash
python ping_pulse_offline.py   /path/to/your/data_dir --language en --model pulse-pro
python ping_pulse_streaming.py /path/to/your/data_dir --language en
```

## Dataset format

Both scripts expect the same input layout. `DATA_DIR` is whatever path you pass on the command line:

```
DATA_DIR/
├── audio/                  # your audio files (.wav, .mp3, .flac, .ogg, .m4a, .webm)
│   ├── clip_001.wav
│   ├── clip_002.mp3
│   └── ...
└── metadata.csv            # ground-truth transcripts
```

`metadata.csv` is comma-separated with exactly two columns, header row required:

```csv
audio_filename,transcript
clip_001.wav,Hello world this is a test.
clip_002.mp3,The quick brown fox jumps over the lazy dog.
```

- `audio_filename` matches a file in `audio/` (just the basename, not a full path).
- `transcript` is the ground-truth text used for WER scoring.

The headers must be spelled exactly `audio_filename,transcript` — the scripts validate this and exit early on a mismatch.

## Language support

Both scripts currently restrict `--language` to `en` (English) and `hi` (Hindi) — the two languages with mature normalisation pipelines for WER scoring. To benchmark another language, edit the `choices=[...]` list in the script and provide pre-normalised reference text.

`ping_pulse_offline.py` supports both `--model pulse` (multilingual) and `--model pulse-pro` (English-only, leaderboard-ranked). `ping_pulse_streaming.py` only supports `pulse`; Pulse Pro is HTTP-only.

## Output

Both scripts print per-clip results live + an aggregate summary table at the end. They also write a JSON results file to `DATA_DIR/`:

- `ping_pulse_offline.py`  → `DATA_DIR/results_batch_<model>_<lang>.json`
- `ping_pulse_streaming.py` → `DATA_DIR/results_streaming_<lang>.json`

The JSON has an `aggregate` block and a `clips` array with per-clip detail:

```json
{
  "aggregate": {
    "mode": "batch",
    "language": "en",
    "model": "pulse-pro",
    "endpoint": "https://api.smallest.ai/waves/v1/stt/",
    "num_clips": 5,
    "corpus_wer_pct": 10.26,
    "latency_p50_s": 0.693,
    "latency_p90_s": 0.781,
    "latency_p95_s": 0.781,
    "rtf_p50": 0.2051,
    "rtf_p90": 0.3753,
    "rtf_p95": 0.3753
  },
  "clips": [
    {"audio_filename": "clip_001.wav", "reference": "...", "hypothesis": "...",
     "wer_pct": 0.0, "latency_s": 0.69, "rtf": 0.27, "server_rtfx": 32.5}
  ]
}
```

Pipe to `jq` to extract just the headline numbers:

```bash
jq '.aggregate' /path/to/data/results_batch_pulse-pro_en.json
```

## What this measures vs. what it doesn't

These scripts measure **wall-clock client-observed latency**, which includes network transit + server processing + client overhead. They do **not** attribute latency by component. For component attribution (network vs model vs client), see the [docs page](https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/benchmarks/measuring-latency#component-breakdown).

For streaming, the script reports **tail latency** — the time from the last audio chunk being sent to the final transcript landing. It does **not** report transcript latency (the running gap during the session) or end-of-utterance latency (silence → final). Both of those require client-side instrumentation; see the docs page for measurement patterns.

## Questions / issues

Open an issue on this repo, ping us on [Discord](https://discord.gg/9WtSXv26WE), or email [support@smallest.ai](mailto:support@smallest.ai).
