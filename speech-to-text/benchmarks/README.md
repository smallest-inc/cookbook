# Pulse STT — Benchmarking Scripts

Self-contained reference scripts for measuring Pulse STT **accuracy** (Word Error Rate) and **latency** against your own evaluation dataset. Use these as a starting point for vendor comparisons or regression testing on a model upgrade.

Both scripts are single-file, no imports from this repo. Copy either one anywhere and run.

## Scripts

| Script | Endpoint | Reports |
|---|---|---|
| [`ping_pulse_offline.py`](./ping_pulse_offline.py) | `POST /waves/v1/stt/` (pre-recorded HTTP) | WER (corpus-level), per-clip latency, RTF (real-time factor) at p50 / p90 / p95 |
| [`ping_pulse_streaming.py`](./ping_pulse_streaming.py) | `WSS /waves/v1/stt/live` (real-time WebSocket) | WER (corpus-level), tail latency at p50 / p90 / p95 |

For the methodology behind each metric — what tail latency means, how RTF is computed, which transcripts to sample from — see the [Measuring Latency docs page](https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/benchmarks/measuring-latency).

## Quick start

```bash
# 1. Install dependencies (one time)
pip install jiwer tqdm numpy librosa websockets
# If you'll evaluate English audio:
pip install whisper-normalizer

# 2. Set your API key
export SMALLEST_API_KEY=sk_your_key_here

# 3. Prepare your eval folder (see "Dataset format" below)

# 4. Run
python ping_pulse_offline.py   /path/to/data_dir --language en --model pulse-pro
python ping_pulse_streaming.py /path/to/data_dir --language en
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

`metadata.csv` is comma-separated with one row per clip:

```csv
filename,reference
clip_001.wav,Hello world this is a test.
clip_002.mp3,The quick brown fox jumps over the lazy dog.
```

The `filename` column matches a file in `audio/`. The `reference` column is the ground-truth transcript used for WER scoring.

## Language support

Both scripts currently restrict `--language` to `en` (English) and `hi` (Hindi) — the two languages with mature normalisation pipelines for WER scoring. To benchmark another language, edit the `choices=[...]` list in the script and provide pre-normalised reference text.

`ping_pulse_offline.py` supports both `--model pulse` (multilingual) and `--model pulse-pro` (English-only, leaderboard-ranked). `ping_pulse_streaming.py` only supports `pulse`; Pulse Pro is HTTP-only.

## Output

Both scripts print a JSON aggregate at the end:

```json
{
  "aggregate": {
    "mode": "batch",
    "language": "en",
    "model": "pulse-pro",
    "num_clips": 250,
    "corpus_wer_pct": 4.55,
    "latency_p50_s": 0.42,
    "latency_p95_s": 0.87,
    "rtf_p50": 0.012,
    "rtf_p95": 0.024
  },
  "clips": [ ... ]
}
```

Pipe to `jq` to extract just the headline numbers:

```bash
python ping_pulse_offline.py /path/to/data --language en | jq '.aggregate'
```

## What this measures vs. what it doesn't

These scripts measure **wall-clock client-observed latency**, which includes network transit + server processing + client overhead. They do **not** attribute latency by component. For component attribution (network vs model vs client), see the [docs page](https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/benchmarks/measuring-latency#component-breakdown).

For streaming, the script reports **tail latency** — the time from the last audio chunk being sent to the final transcript landing. It does **not** report transcript latency (the running gap during the session) or end-of-utterance latency (silence → final). Both of those require client-side instrumentation; see the docs page for measurement patterns.

## Questions / issues

Open an issue on this repo, ping us on [Discord](https://discord.gg/9WtSXv26WE), or email [support@smallest.ai](mailto:support@smallest.ai).
