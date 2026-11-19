"""Record from the default input mic to a 16 kHz mono WAV.

Requires: sounddevice, soundfile, numpy.
"""

from __future__ import annotations

import argparse
import sys
import time
import wave

import numpy as np
import sounddevice as sd


SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = "int16"


def record(seconds: float, out_path: str) -> None:
    frames = int(seconds * SAMPLE_RATE)
    print(f"Recording {seconds:.1f}s @ {SAMPLE_RATE} Hz mono → {out_path}", flush=True)
    print("Speak now...", flush=True)
    audio = sd.rec(frames, samplerate=SAMPLE_RATE, channels=CHANNELS, dtype=DTYPE)
    sd.wait()
    audio = np.asarray(audio, dtype=np.int16).reshape(-1)

    with wave.open(out_path, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio.tobytes())

    rms = float(np.sqrt(np.mean(audio.astype(np.float32) ** 2)))
    peak = int(np.max(np.abs(audio)))
    duration = len(audio) / SAMPLE_RATE
    print(
        f"Saved {out_path}: duration={duration:.2f}s rms={rms:.0f} peak={peak}",
        flush=True,
    )
    if peak < 500:
        print("WARN: peak amplitude is very low, check mic gain.", file=sys.stderr)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("-o", "--out", required=True, help="output WAV path")
    p.add_argument("-s", "--seconds", type=float, default=3.0)
    p.add_argument("--countdown", type=int, default=1)
    args = p.parse_args()

    for i in range(args.countdown, 0, -1):
        print(f"{i}...", flush=True)
        time.sleep(1)

    record(args.seconds, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
