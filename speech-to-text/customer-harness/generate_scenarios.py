"""Generate the starter scenario WAVs with Smallest TTS (Lightning).

`run_matrix.py` needs WAVs in `scenarios/`, and a fresh clone ships none, so
this script synthesizes the suggested set from `scenarios/README.md` as 16 kHz
mono 16-bit WAVs. Synthetic speech is clean, so treat these as a smoke test
and replace them with real recordings (`mic_record.py`) for real tuning.

  export SMALLEST_API_KEY=sk_...
  python generate_scenarios.py              # writes scenarios/*.wav
  python generate_scenarios.py --force      # overwrite existing files

The key is read from the environment only.
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import wave
from pathlib import Path

import requests

TTS_URL = "https://api.smallest.ai/waves/v1/tts"
SAMPLE_RATE = 16000

SCENARIOS: dict[str, str] = {
    "yes": "Yes.",
    "no": "No.",
    "four": "Four.",
    "rahul_choudhary": "Rahul Choudhary.",
    "twenty_five_thousand": "Twenty five thousand rupees.",
    "open_ended_query": "Please transfer twenty five thousand to Rahul Choudhary.",
    "long_dictation": (
        "Notes from today's call. The customer wants to move their monthly "
        "plan to the annual plan starting next billing cycle. They asked for "
        "the invoice to be sent to the finance team instead of their personal "
        "email. They also reported that the mobile app logs them out every few "
        "days, and they would like someone from support to follow up by "
        "Thursday. Finally, they asked whether the discount from last quarter "
        "still applies after the switch."
    ),
}


def synthesize(text: str, api_key: str, voice_id: str, model: str) -> bytes:
    r = requests.post(
        TTS_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "text": text,
            "voice_id": voice_id,
            "model": model,
            "sample_rate": SAMPLE_RATE,
            "language": "en",
            "output_format": "wav",
        },
        timeout=60,
    )
    if r.status_code != 200:
        # Print the status and the server's message only. Never echo request headers.
        raise RuntimeError(f"TTS failed: HTTP {r.status_code}: {r.text[:200]}")
    return r.content


def check_wav(data: bytes) -> float:
    with wave.open(io.BytesIO(data), "rb") as wf:
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != SAMPLE_RATE:
            raise RuntimeError(
                f"unexpected WAV format: channels={wf.getnchannels()} "
                f"width={wf.getsampwidth()} rate={wf.getframerate()}"
            )
        return wf.getnframes() / wf.getframerate()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(Path(__file__).with_name("scenarios")))
    p.add_argument("--voice-id", default="lakshya")
    p.add_argument("--model", default="lightning_v3.1")
    p.add_argument("--only", nargs="*", help="Subset of scenario names to generate.")
    p.add_argument("--force", action="store_true", help="Overwrite existing WAVs.")
    args = p.parse_args()

    api_key = os.getenv("SMALLEST_API_KEY", "")
    if not api_key:
        print("SMALLEST_API_KEY is not set.", file=sys.stderr)
        return 1

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    names = args.only or list(SCENARIOS)
    unknown = [n for n in names if n not in SCENARIOS]
    if unknown:
        print(f"unknown scenarios: {unknown}; choose from {list(SCENARIOS)}", file=sys.stderr)
        return 2

    for name in names:
        path = out / f"{name}.wav"
        if path.exists() and not args.force:
            print(f"skip {path} (exists, pass --force to overwrite)")
            continue
        data = synthesize(SCENARIOS[name], api_key, args.voice_id, args.model)
        seconds = check_wav(data)
        path.write_bytes(data)
        print(f"wrote {path} ({seconds:.1f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
