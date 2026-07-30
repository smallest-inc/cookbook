#!/usr/bin/env python3
"""Ping prod Pulse STREAMING (real-time WebSocket STT) and report accuracy + latency.

================================================================================
WHAT THIS SCRIPT DOES
================================================================================
It takes a folder of audio files plus their correct transcripts, sends each
audio file to Smallest AI's *streaming* Pulse speech-to-text service exactly the
way a live application would (audio streamed in small chunks, in real time), and
then prints how ACCURATE and how FAST the service was:

  * Accuracy -> Word Error Rate (WER), as a percentage. Lower is better.
  * Speed    -> tail latency (explained under "METRICS" below).

This is completely self-contained: it imports nothing from this repo's code.
You can copy this single file anywhere and run it.

================================================================================
STEP 1 — INSTALL THE DEPENDENCIES (one time)
================================================================================
This script needs these Python packages installed in your environment:

    pip install numpy librosa websockets jiwer tqdm

If (and only if) you will transcribe ENGLISH audio, also install:

    pip install whisper-normalizer

(Inside this repo's conda env these are already installed — you can skip this.)

================================================================================
STEP 2 — SET YOUR API KEY
================================================================================
You need a Smallest AI API key, provided as an environment variable named
SMALLEST_API_KEY. Two ways:

  (a) In this repo, keep the key in the .env file and prefix commands with
      `dotenv run` (this loads .env for you):

          dotenv run python scripts/ping_pulse_streaming.py ...

  (b) Anywhere else, export it yourself first:

          export SMALLEST_API_KEY=sk_your_key_here
          python ping_pulse_streaming.py ...

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
    # English audio:
    dotenv run python scripts/ping_pulse_streaming.py DATA_DIR --language en

    # Hindi audio:
    dotenv run python scripts/ping_pulse_streaming.py DATA_DIR --language hi

Results are printed to the screen AND saved to a JSON file inside DATA_DIR
named results_streaming_<language>.json (per-clip details + an aggregate block).

================================================================================
METRICS — HOW TO READ THE OUTPUT
================================================================================
  * WER (%)        Word Error Rate. 0% = perfect. Computed with jiwer after
                   text normalization (English: Whisper's EnglishTextNormalizer;
                   Hindi: strip punctuation + lowercase). Corpus WER pools every
                   clip's errors: sum(substitutions+deletions+insertions)/sum(ref words).

  * tail latency   Audio is streamed at real-time speed; this is the gap from
                   sending the LAST piece of audio to receiving the FINAL
                   transcript — i.e. how long after you stop talking the result
                   is fully done.

Clips are processed one at a time (sequentially) so these latency numbers are
never inflated by running several streams in parallel.

================================================================================
WHICH PROD MODES THIS COVERS
================================================================================
  Hindi   — Pulse Streaming :  --language hi
  English — Pulse Streaming :  --language en
(The offline/batch modes, including English "Pulse Pro", live in the sibling
script ping_pulse_batch.py.)
"""

import argparse
import asyncio
import csv
import json
import os
import re
import time
import unicodedata
from pathlib import Path

import numpy as np
import websockets

from jiwer import process_words
from tqdm import tqdm

PULSE_WS_URL = os.environ.get("PULSE_WS_URL", "wss://api.smallest.ai/waves/v1/stt/live")

SAMPLE_RATE = 16000
ENCODING = "linear16"        # 16-bit signed little-endian PCM — what Pulse expects on the wire
CHUNK_SECONDS = 0.160
CHUNK_SAMPLES = int(CHUNK_SECONDS * SAMPLE_RATE)


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


# ── Streaming a single clip ───────────────────────────────────────────────────


async def stream_clip(audio_path: Path, language: str, api_key: str) -> dict[str, float | str]:
    """Stream one clip in real time; return transcript + timing fields."""

    import librosa

    audio, _ = librosa.load(audio_path.as_posix(), sr=SAMPLE_RATE, mono=True)
    audio_seconds = len(audio) / SAMPLE_RATE

    params = f"model=pulse&language={language}&encoding={ENCODING}&sample_rate={SAMPLE_RATE}"
    ws_url = f"{PULSE_WS_URL}?{params}"

    segments: list[str] = []
    received_is_last = False

    # Timing markers (perf_counter seconds).
    timing: dict[str, float | None] = {"audio_end": None, "final": None, "last_message": None}

    async with websockets.connect(
        ws_url,
        additional_headers={"Authorization": f"Bearer {api_key}"},
        open_timeout=15,
        ping_interval=None,
    ) as websocket:

        async def send_audio():
            for offset in range(0, len(audio), CHUNK_SAMPLES):
                chunk = audio[offset:offset + CHUNK_SAMPLES]
                await websocket.send((chunk * 32768.0).astype(np.int16).tobytes())
                # Pace at real time so tail latency reflects live streaming. Sleep by
                # the chunk's ACTUAL duration so the final (shorter) chunk doesn't
                # push audio_end late and understate tail latency.
                await asyncio.sleep(len(chunk) / SAMPLE_RATE)
            timing["audio_end"] = time.perf_counter()
            await websocket.send(json.dumps({"type": "close_stream"}))

        async def receive_transcripts():
            nonlocal received_is_last
            while True:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data: dict[str, object] = json.loads(message)
                except asyncio.TimeoutError:
                    break

                timing["last_message"] = time.perf_counter()

                if data.get("error"):
                    raise RuntimeError(f"Pulse error: {data.get('code')} {data.get('error')}")

                transcript = data.get("transcript")
                if data.get("is_final"):
                    if not isinstance(transcript, str):
                        raise RuntimeError(f"is_final without string transcript: {data!r}")
                    segments.append(transcript)

                if data.get("is_last"):
                    received_is_last = True
                    timing["final"] = time.perf_counter()
                    break

        sender = asyncio.create_task(send_audio())
        try:
            await receive_transcripts()
        finally:
            # If the receiver returned/raised before the sender finished, don't
            # leave it pending (orphaned task warnings / unretrieved exceptions).
            if not sender.done():
                sender.cancel()
            try:
                await sender
            except BaseException:
                pass

    if not received_is_last and not segments:
        raise RuntimeError("session ended without is_last and no is_final segments (server stall?)")

    # If we stopped on the 5 s quiet timeout rather than is_last, use the time of
    # the last message received as the final-transcript timestamp.
    if timing["final"] is None and timing["last_message"] is not None:
        timing["final"] = timing["last_message"]

    hypothesis = "".join(segments).strip()
    tail_latency = (timing["final"] - timing["audio_end"]) if timing["final"] and timing["audio_end"] else float("nan")

    return {"hypothesis": hypothesis, "audio_seconds": audio_seconds, "tail_latency": tail_latency}


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


async def run(data_dir: Path, language: str, api_key: str) -> dict[str, object]:

    normalize = make_normalizer(language)
    rows = read_metadata(data_dir)

    per_clip: list[dict[str, object]] = []
    total_subs = total_dels = total_ins = total_ref_words = 0

    for audio_filename, reference in tqdm(rows, desc="streaming", unit="clip"):
        audio_path = data_dir / "audio" / audio_filename
        if not audio_path.exists():
            tqdm.write(f"  [skip] missing audio: {audio_path}")
            continue

        result = await stream_clip(audio_path, language, api_key)
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

        clip = {
            "audio_filename": audio_filename,
            "reference": reference,
            "hypothesis": hypothesis,
            "wer_pct": round(clip_wer, 2),
            "subs": subs,
            "dels": dels,
            "ins": ins,
            "ref_words": ref_words,
            "audio_seconds": round(float(result["audio_seconds"]), 2),
            "tail_latency_s": round(float(result["tail_latency"]), 3),
            "norm_reference": norm_ref,
            "norm_hypothesis": norm_hyp,
        }
        per_clip.append(clip)

        # ref/hyp shown here are the NORMALIZED strings actually scored.
        tqdm.write(
            f"  {audio_filename}: WER={clip['wer_pct']}%  "
            f"tail={clip['tail_latency_s']}s\n"
            f"      ref: {norm_ref}\n"
            f"      hyp: {norm_hyp}"
        )

    corpus_wer = (100.0 * (total_subs + total_dels + total_ins) / total_ref_words) if total_ref_words else float("nan")
    tails = [float(clip["tail_latency_s"]) for clip in per_clip]

    aggregate = {
        "mode": "streaming",
        "language": language,
        "endpoint": PULSE_WS_URL,
        "num_clips": len(per_clip),
        "corpus_wer_pct": round(corpus_wer, 2),
        "tail_p50_s": round(percentile(tails, 0.50), 3),
        "tail_p90_s": round(percentile(tails, 0.90), 3),
        "tail_p95_s": round(percentile(tails, 0.95), 3),
    }
    return {"aggregate": aggregate, "clips": per_clip}


def main():

    parser = argparse.ArgumentParser(description="Ping prod Pulse streaming; report WER + tail latency.")
    parser.add_argument("data_dir", type=Path, help="Directory with audio/ and metadata.csv")
    parser.add_argument("--language", required=True, choices=["en", "hi"], help="Pulse language code")
    args = parser.parse_args()

    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        raise SystemExit("SMALLEST_API_KEY is not set (run via `dotenv run`).")
    if not (args.data_dir / "metadata.csv").exists():
        raise SystemExit(f"metadata.csv not found in {args.data_dir}")

    print(f"Pulse STREAMING  lang={args.language}  endpoint={PULSE_WS_URL}\n")
    output = asyncio.run(run(args.data_dir, args.language, api_key))

    aggregate = output["aggregate"]
    print("\n── Aggregate ──")
    print(f"clips\t\t\t{aggregate['num_clips']}")
    print(f"corpus WER\t\t{aggregate['corpus_wer_pct']}%")
    print(f"tail p50/p90/p95 (s)\t{aggregate['tail_p50_s']}\t{aggregate['tail_p90_s']}\t{aggregate['tail_p95_s']}")

    results_path = args.data_dir / f"results_streaming_{args.language}.json"
    results_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {results_path}")


if __name__ == "__main__":
    main()
