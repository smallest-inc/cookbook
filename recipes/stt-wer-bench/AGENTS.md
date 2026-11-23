# AGENTS.md

Instructions for coding agents (Claude Code, Cursor, Codex) working in this recipe.

## What this is

A speech to text benchmark for Pulse. It sends audio clips to the Pulse API, compares the transcripts with reference text, and writes WER or CER per dataset, per language and per tag, plus latency and end-of-turn stats for `pulse-2`. Results go to `results/<run_name>/summary.md`.

Smallest AI docs for agents: https://docs.smallest.ai/llms.txt

## Run and test

```bash
make setup     # uv pip install -r requirements.txt
make test      # offline, no key, no network; run this after every change
make smoke     # 4 bundled clips against the live API; needs SMALLEST_API_KEY
make run       # the user's own audio, settings from config/bench.yaml
```

`make help` lists the other tracks (ESB, FLEURS, end-of-turn).

## Make it yours

Edit these, nothing else, to point the bench at someone's audio:

- `config/bench.yaml`: suite, manifest path, model, language, metric, limits. Keys are the `src/run_eval.py` flag names with underscores
- `my_audio/`: clips plus `.txt` transcripts. `make manifest AUDIO=my_audio CLIP_LANG=xx` builds `my_audio/manifest.jsonl`. Sub-folders become tags in the report

## Do not

- Print, log or write `SMALLEST_API_KEY` anywhere. It is read from the environment or `.env` only. Do not add an `--api-key` flag
- Change the endpoints in `src/pulse_client.py`. They are fixed to `api.smallest.ai` so the key is never sent elsewhere
- Commit `results/`, `my_audio/`, `.env` or any customer audio. They are in `.gitignore`
- Change normalization in `src/scoring.py` casually. It changes every number, so results stop being comparable with earlier runs. If you must, say so in the report
- Quote numbers from `--limit 10` runs as benchmarks. Use 500 or more clips per set for a number you share

## Layout

- `src/run_eval.py`: CLI and report writer
- `src/pulse_client.py`: streaming (WebSocket) and pre-recorded (HTTP) clients
- `src/loaders.py`: ESB, FLEURS and manifest loaders
- `src/scoring.py`: normalization and metrics
- `src/make_manifest.py`: builds a manifest from a folder
- `tests/`: offline tests with a fake Pulse client (`tests/test_run_eval.py::FakePulse`)

## Known limits

- `pulse-2` is English only and streaming only. The bench refuses other languages for it
- Some accounts do not have every language or `pulse-2` enabled. The report shows the server's reason (`LANGUAGE_NOT_ENABLED_IN_REGION`, `MODEL_NOT_ENABLED`) instead of a score
