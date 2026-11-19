"""HTTP client for the offline /transcribe endpoint with the same augmentations.

Applies clip / noise / resample to the WAV before POSTing so the same failure
modes can be reproduced end-to-end on the batch API.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import wave
from urllib.parse import urlparse

import numpy as np
import requests

from augmentations import add_noise, clip_head, clip_tail, resample_and_back


def load_wav_int16(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        return np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16), wf.getframerate()


def pcm_to_wav_bytes(pcm: np.ndarray, sample_rate: int) -> bytes:
    import io

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.astype(np.int16).tobytes())
    return buf.getvalue()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--wav", required=True)
    p.add_argument(
        "--url",
        default="https://api.smallest.ai/waves/v1/stt/",
        help="HTTP URL. Defaults to api.smallest.ai (auto region routing). "
             "Pass https://api.<region>.smallest.ai/waves/v1/stt/ to pin.",
    )
    p.add_argument(
        "--model",
        default="pulse",
        help="STT model (query param).",
    )
    p.add_argument("--language", default="en", help="ISO 639-1 code, for example en or hi.")
    p.add_argument("--word-timestamps", action=argparse.BooleanOptionalAction, default=False)
    p.add_argument("--diarize", action=argparse.BooleanOptionalAction, default=False)
    p.add_argument("--numerals", default="auto", choices=["auto", "true", "false"])
    p.add_argument("--clip-head", type=int, default=0)
    p.add_argument("--clip-tail", type=int, default=0)
    p.add_argument("--snr", type=float, default=None)
    p.add_argument("--bad-resample-hz", type=int, default=0)
    args = p.parse_args()

    pcm, sr = load_wav_int16(args.wav)
    if args.clip_head:
        pcm = clip_head(pcm, args.clip_head, sr)
    if args.clip_tail:
        pcm = clip_tail(pcm, args.clip_tail, sr)
    if args.snr is not None:
        pcm = add_noise(pcm, args.snr)
    if args.bad_resample_hz:
        pcm = resample_and_back(pcm, sr, args.bad_resample_hz)

    body = pcm_to_wav_bytes(pcm, sr)
    params = {
        "model": args.model,
        "language": args.language,
        "word_timestamps": str(args.word_timestamps).lower(),
        "diarize": str(args.diarize).lower(),
        "numerals": args.numerals,
        "sample_rate": sr,
        "encoding": "linear16",
    }
    # The key is read from the environment only, never from argv.
    api_key = os.getenv("SMALLEST_API_KEY", "")
    headers = {}
    if api_key:
        parsed = urlparse(args.url)
        if parsed.scheme != "https" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise SystemExit("Refusing to send SMALLEST_API_KEY over plain http:// to a non-local host. Use https://.")
        headers = {"Authorization": f"Bearer {api_key}"}
    else:
        print("note: SMALLEST_API_KEY is not set, sending without auth", file=sys.stderr)
    r = requests.post(args.url, params=params, data=body, headers=headers, timeout=120)
    r.raise_for_status()
    print(json.dumps(r.json(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
