#!/usr/bin/env python3
"""Live, cheap checks against Smallest AI: one Lightning line, one Pulse pass, one Electron reply.

Spends at most one short TTS call (cached after the first run), one STT call and one LLM call.
Writes the results to samples/LIVE_TEST.md. Never prints the key.
"""

from __future__ import annotations

import os
import time
import wave
from io import BytesIO
from pathlib import Path

import server

ROOT = Path(__file__).resolve().parent
LOG_PATH = ROOT / "samples" / "LIVE_TEST.md"


def main() -> None:
    if not os.environ.get("SMALLEST_API_KEY", "").strip():
        raise SystemExit("Set SMALLEST_API_KEY first. Do not print it.")
    results: list[str] = []

    text, voice = server.line_voice("metro", 0)
    t0 = time.monotonic()
    audio, cached = server.synthesize(text, voice)
    with wave.open(BytesIO(audio)) as handle:
        seconds = handle.getnframes() / handle.getframerate()
    results.append(
        f"- Lightning ({server.TTS_MODEL}, {voice}): pass, {seconds:.1f}s clip, "
        f"{'cache hit' if cached else f'{time.monotonic() - t0:.1f}s live'}"
    )

    t0 = time.monotonic()
    heard = server.transcribe(audio)
    results.append(
        f"- Pulse ({server.STT_MODEL}) on that clip: {time.monotonic() - t0:.1f}s, heard: {heard!r}"
    )

    t0 = time.monotonic()
    reply = server.build_reply(
        "metro",
        "there's a guy in a pink flamingo shirt stealing a jet ski at Heron Marina",
        [],
    )
    lines = "; ".join(f"{c['speaker']}: {c['text']}" for c in reply["calls"])  # type: ignore[index]
    results.append(
        f"- Electron reply ({reply['source']}): {time.monotonic() - t0:.1f}s, {lines}"
    )

    stamp = time.strftime("%d %b %Y %H:%M %Z")
    LOG_PATH.parent.mkdir(exist_ok=True)
    LOG_PATH.write_text(
        f"Live smoke test, {stamp}.\n\n"
        + "\n".join(results)
        + "\n\nNo API keys are stored in this file.\n"
    )
    print("\n".join(results))


if __name__ == "__main__":
    main()
