#!/usr/bin/env python3
"""Ping prod Pulse BATCH (offline/pre-recorded STT) and report accuracy + latency.

================================================================================
WHAT THIS SCRIPT DOES
================================================================================
It takes a folder of audio files plus their correct transcripts, sends each
audio file to Smallest AI's *pre-recorded* (offline) Pulse speech-to-text
service — one whole file per HTTP request — and prints how ACCURATE and how
FAST the service was:

  * Accuracy -> Word Error Rate (WER), as a percentage. Lower is better.
  * Speed    -> request latency and RTF (explained under "METRICS" below).

It calls the model-tiered endpoint, so it can hit either the multilingual
"pulse" model or the English-only, highest-accuracy "pulse-pro" model:

    POST https://api.smallest.ai/waves/v1/stt/?model={pulse|pulse-pro}&language=<lang>

This is completely self-contained: it imports nothing from this repo's code.
You can copy this single file anywhere and run it.

================================================================================
STEP 1 — INSTALL THE DEPENDENCIES (one time)
================================================================================
This script needs these Python packages (scoring + progress bar):

    pip install jiwer tqdm

If (and only if) you will transcribe ENGLISH audio, also install:

    pip install whisper-normalizer

There is NO audio library to install: the HTTP call uses Python's built-in
urllib, and audio duration is read from the service's own response.
(Inside this repo's conda env these are already installed — you can skip this.)

================================================================================
STEP 2 — SET YOUR API KEY
================================================================================
You need a Smallest AI API key, provided as an environment variable named
SMALLEST_API_KEY. Two ways:

  (a) In this repo, keep the key in the .env file and prefix commands with
      `dotenv run` (this loads .env for you):

          dotenv run python scripts/ping_pulse_batch.py ...

  (b) Anywhere else, export it yourself first:

          export SMALLEST_API_KEY=sk_your_key_here
          python ping_pulse_batch.py ...

================================================================================
STEP 3 — PREPARE YOUR INPUT FOLDER
================================================================================
Point the script at a folder (call it DATA_DIR) that contains:

    DATA_DIR/
    ├── audio/                 <- put all your audio files in here (wav, mp3, ...)
    │   ├── clip_001.wav
    │   ├── clip_002.wav
    │   └── ...
    └── metadata.csv           <- a CSV with EXACTLY these two column headers:
                                  audio_filename,transcript

`metadata.csv` example (the header row is required, spelled exactly like this):

    audio_filename,transcript
    clip_001.wav,hello how are you
    clip_002.wav,the quick brown fox

  * audio_filename = the file's name inside the audio/ folder (NOT a full path).
  * transcript     = the ground-truth / correct text for that audio.

================================================================================
STEP 4 — RUN IT
================================================================================
    # Hindi audio, multilingual "pulse" model:
    dotenv run python scripts/ping_pulse_batch.py DATA_DIR --language hi --model pulse

    # English audio, highest-accuracy "pulse-pro" model:
    dotenv run python scripts/ping_pulse_batch.py DATA_DIR --language en --model pulse-pro

  * --model defaults to "pulse" if omitted.
  * "pulse-pro" is English-only; the script refuses --language hi with it.

Results are printed to the screen AND saved to a JSON file inside DATA_DIR
named results_batch_<model>_<language>.json (per-clip details + an aggregate block).

================================================================================
METRICS — HOW TO READ THE OUTPUT
================================================================================
  * WER (%)        Word Error Rate. 0% = perfect. Computed with jiwer after
                   text normalization (English: Whisper's EnglishTextNormalizer;
                   Hindi: strip punctuation + lowercase). Corpus WER pools every
                   clip's errors: sum(substitutions+deletions+insertions)/sum(ref words).

  * latency (s)    Wall-clock time of the HTTP request as measured by THIS client
                   (network + server processing). Lower is better.

  * RTF            "Real-Time Factor", the standard definition:
                       RTF = processing_time / audio_duration
                   where processing_time here is THIS client's round-trip latency
                   (so it includes network). RTF of 0.1 means it took one-tenth of
                   the audio's length (10x faster than real time); below 1.0 is
                   faster than real time. Reported as p50/p90/p95 across clips
                   (p90/p95 are the slow tail).

  * server_rtfx /  When the service returns its own timing (pulse-pro does), these
    server_processing_time_ms are surfaced too. server_rtfx is the INVERSE of RTF
                   measured server-side only (audio_duration / server_processing_time),
                   e.g. 50 = 50x faster than real time, excluding network.

Clips are processed one at a time (sequentially) so latency is never inflated by
running several requests in parallel.

================================================================================
WHICH PROD MODES THIS COVERS
================================================================================
  Hindi   — Pulse Batch      :  --language hi --model pulse
  English — Pulse Pro Batch   :  --language en --model pulse-pro
(The real-time/streaming modes live in the sibling script ping_pulse_streaming.py.)
"""

import argparse
import csv
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlencode

from jiwer import process_words
from tqdm import tqdm

PULSE_BATCH_URL = os.environ.get("PULSE_BATCH_URL", "https://api.smallest.ai/waves/v1/stt/")


# ── Normalization ───────────────────────────────────────────────────────────


def strip_punctuation(text: str) -> str:
    """Drop Unicode punctuation/symbols, collapse whitespace, lowercase."""

    cleaned = "".join(character if unicodedata.category(character)[0] not in ("P", "S") else " " for character in text)
    return re.sub(r"\s+", " ", cleaned).strip().lower()


def make_normalizer(language: str):
    """Return a text normalizer for the language.

    English uses Whisper's EnglishTextNormalizer (lazy import — only here).
    Hindi (and anything else) uses the simple strip-punctuation normalizer;
    Whisper's Hindi normalizer crashes on native Devanagari digits.
    """

    if language == "en":
        from whisper_normalizer.english import EnglishTextNormalizer

        english_normalizer = EnglishTextNormalizer()
        return lambda text: english_normalizer(text)
    return strip_punctuation


# ── Transcribing a single clip ────────────────────────────────────────────────


def transcribe_clip(audio_path: Path, language: str, model: str, api_key: str) -> dict[str, object]:
    """POST raw audio bytes; return transcript + timing fields."""

    url = f"{PULSE_BATCH_URL}?{urlencode({'model': model, 'language': language})}"
    request = urllib.request.Request(
        url,
        data=audio_path.read_bytes(),
        method="POST",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/octet-stream"},
    )

    start = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {error.code} from Pulse batch: {body}") from error
    latency = time.perf_counter() - start

    transcript = payload.get("transcription")
    if not isinstance(transcript, str):
        raise RuntimeError(f"response missing string 'transcription': {payload!r}")

    metadata = payload.get("metadata") or {}
    return {
        "hypothesis": transcript,
        "latency": latency,
        "audio_seconds": metadata.get("duration"),
        "processing_time_ms": metadata.get("processing_time_ms"),
        "rtfx": metadata.get("rtfx"),
    }


# ── Aggregation helpers ───────────────────────────────────────────────────────


def percentile(values: list[float], fraction: float) -> float:
    """Nearest-rank percentile of a list (fraction in [0, 1])."""

    finite = sorted(value for value in values if value == value)  # drop NaN
    if not finite:
        return float("nan")
    index = min(len(finite) - 1, max(0, round(fraction * (len(finite) - 1))))
    return finite[index]


def read_metadata(data_dir: Path) -> list[tuple[str, str]]:
    """Read metadata.csv -> list of (audio_filename, transcript)."""

    rows: list[tuple[str, str]] = []
    with (data_dir / "metadata.csv").open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None or "audio_filename" not in reader.fieldnames or "transcript" not in reader.fieldnames:
            raise SystemExit(f"metadata.csv must have headers 'audio_filename,transcript' (got {reader.fieldnames})")
        for row in reader:
            rows.append((row["audio_filename"].strip(), row["transcript"]))
    return rows


# ── Main ──────────────────────────────────────────────────────────────────────


def run(data_dir: Path, language: str, model: str, api_key: str) -> dict[str, object]:

    normalize = make_normalizer(language)
    rows = read_metadata(data_dir)

    per_clip: list[dict[str, object]] = []
    total_subs = total_dels = total_ins = total_ref_words = 0

    for audio_filename, reference in tqdm(rows, desc="batch", unit="clip"):
        audio_path = data_dir / "audio" / audio_filename
        if not audio_path.exists():
            tqdm.write(f"  [skip] missing audio: {audio_path}")
            continue

        result = transcribe_clip(audio_path, language, model, api_key)
        hypothesis = str(result["hypothesis"])

        norm_ref = normalize(reference)
        norm_hyp = normalize(hypothesis)
        measured = process_words(norm_ref, norm_hyp) if norm_ref.strip() else None

        if measured is not None:
            subs, dels, ins = measured.substitutions, measured.deletions, measured.insertions
            ref_words = len(measured.references[0])
            clip_wer = measured.wer * 100.0
            total_subs += subs
            total_dels += dels
            total_ins += ins
            total_ref_words += ref_words
        else:
            subs = dels = ins = ref_words = 0
            clip_wer = float("nan")

        latency = float(result["latency"])
        audio_seconds = result["audio_seconds"]
        rtf = (latency / audio_seconds) if isinstance(audio_seconds, (int, float)) and audio_seconds else float("nan")

        clip = {
            "audio_filename": audio_filename,
            "reference": reference,
            "hypothesis": hypothesis,
            "wer_pct": round(clip_wer, 2),
            "subs": subs,
            "dels": dels,
            "ins": ins,
            "ref_words": ref_words,
            "audio_seconds": round(audio_seconds, 2) if isinstance(audio_seconds, (int, float)) else None,
            "latency_s": round(latency, 3),
            "rtf": round(rtf, 4),
            "server_processing_time_ms": result["processing_time_ms"],
            "server_rtfx": result["rtfx"],
            "norm_reference": norm_ref,
            "norm_hypothesis": norm_hyp,
        }
        per_clip.append(clip)

        # ref/hyp shown here are the NORMALIZED strings actually scored.
        tqdm.write(
            f"  {audio_filename}: WER={clip['wer_pct']}%  "
            f"latency={clip['latency_s']}s  RTF={clip['rtf']}"
            + (f"  server_rtfx={clip['server_rtfx']}" if clip["server_rtfx"] is not None else "")
            + f"\n      ref: {norm_ref}\n      hyp: {norm_hyp}"
        )

    corpus_wer = (100.0 * (total_subs + total_dels + total_ins) / total_ref_words) if total_ref_words else float("nan")
    latencies = [float(clip["latency_s"]) for clip in per_clip]
    rtfs = [float(clip["rtf"]) for clip in per_clip]

    aggregate = {
        "mode": "batch",
        "language": language,
        "model": model,
        "endpoint": PULSE_BATCH_URL,
        "num_clips": len(per_clip),
        "corpus_wer_pct": round(corpus_wer, 2),
        "latency_p50_s": round(percentile(latencies, 0.50), 3),
        "latency_p90_s": round(percentile(latencies, 0.90), 3),
        "latency_p95_s": round(percentile(latencies, 0.95), 3),
        "rtf_p50": round(percentile(rtfs, 0.50), 4),
        "rtf_p90": round(percentile(rtfs, 0.90), 4),
        "rtf_p95": round(percentile(rtfs, 0.95), 4),
    }
    return {"aggregate": aggregate, "clips": per_clip}


def main():

    parser = argparse.ArgumentParser(description="Ping prod Pulse batch (offline); report WER + latency + RTF.")
    parser.add_argument("data_dir", type=Path, help="Directory with audio/ and metadata.csv")
    parser.add_argument("--language", required=True, choices=["en", "hi"], help="Pulse language code")
    parser.add_argument("--model", default="pulse", choices=["pulse", "pulse-pro"], help="Model tier (pulse-pro is English-only)")
    args = parser.parse_args()

    if args.model == "pulse-pro" and args.language != "en":
        raise SystemExit("pulse-pro is English-only; use --language en.")

    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        raise SystemExit("SMALLEST_API_KEY is not set (run via `dotenv run`).")
    if not (args.data_dir / "metadata.csv").exists():
        raise SystemExit(f"metadata.csv not found in {args.data_dir}")

    print(f"Pulse BATCH  model={args.model}  lang={args.language}  endpoint={PULSE_BATCH_URL}\n")
    output = run(args.data_dir, args.language, args.model, api_key)

    aggregate = output["aggregate"]
    print("\n── Aggregate ──")
    print(f"clips\t\t\t{aggregate['num_clips']}")
    print(f"corpus WER\t\t{aggregate['corpus_wer_pct']}%")
    print(f"latency p50/p90/p95 (s)\t{aggregate['latency_p50_s']}\t{aggregate['latency_p90_s']}\t{aggregate['latency_p95_s']}")
    print(f"RTF p50/p90/p95\t\t{aggregate['rtf_p50']}\t{aggregate['rtf_p90']}\t{aggregate['rtf_p95']}")

    results_path = args.data_dir / f"results_batch_{args.model}_{args.language}.json"
    results_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {results_path}")


if __name__ == "__main__":
    main()
