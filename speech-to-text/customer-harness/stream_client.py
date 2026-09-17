"""WebSocket client for Smallest streaming STT with per-CLI-flag augmentations.

Reproduces the customer failure modes documented in the README:

  * Client-side early finalization (--force-finalize-after)
  * Hard stream close (--close-after)
  * Head/tail clipping (--clip-head / --clip-tail)
  * Send-time jitter (--jitter)
  * Noise (--snr)
  * All streaming query params (--eou-timeout-ms, --keywords, etc.)

Requires: websockets, numpy, soundfile.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
import wave
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import numpy as np
import websockets

from augmentations import (
    add_noise,
    clip_head,
    clip_tail,
    jittered_delays,
    pack_chunks,
    resample_and_back,
)


# ---- Preset profiles --------------------------------------------------------
# Bundles of client-visible knobs, one per turn distribution. Only the knobs
# the streaming WebSocket accepts as query params are represented here.
PRESETS: dict[str, dict] = {
    "voice_agent_open": {
        "eou_timeout_ms": 900,
        "endpointing": True,
        "finalize_on_words": False,
        "itn_normalize": True,
    },
    "voice_agent_short_reply": {
        "eou_timeout_ms": 550,
        "endpointing": True,
        "finalize_on_words": False,
        "itn_normalize": False,
    },
    "ivr": {
        # Also implies sample_rate=8000, encoding=mulaw — see README. The harness
        # takes sample_rate from the input WAV, so IVR-format audio must be
        # supplied as such.
        "eou_timeout_ms": 500,
        "endpointing": True,
        "finalize_on_words": False,
        "itn_normalize": False,
    },
    "dictation": {
        "eou_timeout_ms": 1400,
        "endpointing": False,
        "finalize_on_words": False,
        "itn_normalize": True,
        "word_timestamps": True,
    },
}


@dataclass
class StreamConfig:
    url: str
    model: str = "pulse"
    sample_rate: int = 16000
    encoding: str = "linear16"
    language: str = "en"
    format_: bool = True
    punctuate: bool = True
    capitalize: bool = True
    itn_normalize: bool = True
    eou_timeout_ms: int = 800
    endpointing: bool = True
    vad_events: bool = True
    max_words: int = 0
    finalize_on_words: bool = True
    word_timestamps: bool = False
    keywords: str = ""

    def to_query(self) -> str:
        params: dict[str, Any] = {
            "model": self.model,
            "sample_rate": self.sample_rate,
            "encoding": self.encoding,
            "language": self.language,
            "format": str(self.format_).lower(),
            "punctuate": str(self.punctuate).lower(),
            "capitalize": str(self.capitalize).lower(),
            "itn_normalize": str(self.itn_normalize).lower(),
            "eou_timeout_ms": self.eou_timeout_ms,
            "endpointing": str(self.endpointing).lower(),
            "vad_events": str(self.vad_events).lower(),
            "finalize_on_words": str(self.finalize_on_words).lower(),
        }
        if self.word_timestamps:
            params["word_timestamps"] = "true"
        if self.max_words > 0:
            params["max_words"] = self.max_words
        if self.keywords:
            params["keywords"] = self.keywords
        return urlencode(params)


def load_wav_int16(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as wf:
        assert wf.getnchannels() == 1, "expected mono"
        assert wf.getsampwidth() == 2, "expected int16"
        sample_rate = wf.getframerate()
        pcm = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16)
    return pcm, sample_rate


async def send_audio(
    ws,
    pcm: np.ndarray,
    sample_rate: int,
    chunk_ms: int,
    jitter_ms: int,
    force_finalize_after_ms: int | None,
    close_after_ms: int | None,
    log,
) -> None:
    chunks = list(pack_chunks(pcm, chunk_ms, sample_rate))
    delays = jittered_delays(len(chunks), chunk_ms, jitter_ms)
    start = time.monotonic()
    finalize_sent = False
    close_sent = False

    for chunk, delay in zip(chunks, delays):
        await ws.send(chunk)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        if (
            force_finalize_after_ms is not None
            and not finalize_sent
            and elapsed_ms >= force_finalize_after_ms
        ):
            log({"event": "client_finalize", "at_ms": elapsed_ms})
            await ws.send(json.dumps({"type": "finalize"}))
            finalize_sent = True
        if (
            close_after_ms is not None
            and not close_sent
            and elapsed_ms >= close_after_ms
        ):
            log({"event": "client_close_stream", "at_ms": elapsed_ms})
            await ws.send(json.dumps({"type": "close_stream"}))
            close_sent = True
            return
        await asyncio.sleep(delay)

    if not close_sent and force_finalize_after_ms is None:
        await ws.send(json.dumps({"type": "close_stream"}))


async def recv_loop(ws, log, start_mono: float) -> None:
    async for msg in ws:
        if isinstance(msg, bytes):
            continue
        try:
            payload = json.loads(msg)
        except Exception:
            log({"event": "recv_non_json", "raw": str(msg)[:200]})
            continue
        payload["t_ms"] = int((time.monotonic() - start_mono) * 1000)
        log(payload)
        if payload.get("is_last"):
            return


def _resolve(cli_value, preset: dict, key: str, base_default):
    """Preset < explicit CLI. `None` means the user did not set the CLI flag."""
    if cli_value is not None:
        return cli_value
    if key in preset:
        return preset[key]
    return base_default


def _apply_augmentations(pcm: np.ndarray, sr: int, args) -> np.ndarray:
    if args.clip_head:
        pcm = clip_head(pcm, args.clip_head, sr)
    if args.clip_tail:
        pcm = clip_tail(pcm, args.clip_tail, sr)
    if args.snr is not None:
        pcm = add_noise(pcm, args.snr)
    if args.bad_resample_hz:
        pcm = resample_and_back(pcm, sr, args.bad_resample_hz)
    return pcm


def _build_config(args, sr: int, preset: dict) -> StreamConfig:
    return StreamConfig(
        url=args.url,
        model=args.model,
        sample_rate=sr,
        language=args.language,
        itn_normalize=_resolve(args.itn_normalize, preset, "itn_normalize", True),
        eou_timeout_ms=_resolve(args.eou_timeout_ms, preset, "eou_timeout_ms", 800),
        endpointing=_resolve(args.endpointing, preset, "endpointing", True),
        max_words=_resolve(args.max_words, preset, "max_words", 0),
        finalize_on_words=_resolve(args.finalize_on_words, preset, "finalize_on_words", True),
        word_timestamps=_resolve(args.word_timestamps, preset, "word_timestamps", False),
        keywords=args.keywords,
    )


def _write_events(path: str, events: list[dict]) -> None:
    with open(path, "w") as f:
        for ev in events:
            f.write(json.dumps(ev) + "\n")
    print(f"wrote {len(events)} events → {path}", flush=True)


def _print_finals(events: list[dict]) -> None:
    finals = [e for e in events if e.get("is_final")]
    print(f"finals={len(finals)}", flush=True)
    for e in finals:
        transcript = e.get("transcript") or e.get("text") or ""
        print(f"  [t={e.get('t_ms')}ms] {transcript!r}", flush=True)


async def _stream(ws_url: str, api_key: str, pcm: np.ndarray, sr: int, args, log) -> None:
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
    async with websockets.connect(
        ws_url,
        max_size=10 * 1024 * 1024,
        additional_headers=headers,
    ) as ws:
        start_mono = time.monotonic()
        recv = asyncio.create_task(recv_loop(ws, log, start_mono))
        await send_audio(
            ws,
            pcm,
            sr,
            args.chunk_ms,
            args.jitter,
            args.force_finalize_after,
            args.close_after,
            log,
        )
        try:
            await asyncio.wait_for(recv, timeout=args.recv_timeout)
        except asyncio.TimeoutError:
            log({"event": "recv_timeout"})


async def run(args) -> None:
    pcm, sr = load_wav_int16(args.wav)
    pcm = _apply_augmentations(pcm, sr, args)

    preset = PRESETS.get(args.preset, {}) if args.preset else {}
    if args.preset:
        print(f"preset={args.preset}: {preset}", flush=True)

    cfg = _build_config(args, sr, preset)
    ws_url = f"{cfg.url}?{cfg.to_query()}"
    print(f"→ {ws_url}", flush=True)

    events: list[dict] = []

    def log(ev: dict) -> None:
        events.append(ev)
        if args.verbose:
            print(json.dumps(ev), flush=True)

    api_key = args.api_key or os.getenv("SMALLEST_API_KEY", "")
    await _stream(ws_url, api_key, pcm, sr, args, log)

    if args.out_jsonl:
        _write_events(args.out_jsonl, events)
    _print_finals(events)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--wav", required=True)
    p.add_argument(
        "--url",
        default="wss://api.smallest.ai/waves/v1/stt/live",
        help="Streaming WebSocket URL. "
             "Use wss://api.us.smallest.ai/waves/v1/stt/live for zh/yue/ja/ko/multi-asian.",
    )
    p.add_argument(
        "--model",
        default="pulse",
        help="ASR model. Only 'pulse' is supported on the streaming endpoint.",
    )
    p.add_argument(
        "--api-key",
        default="",
        help="Smallest API key. Falls back to SMALLEST_API_KEY env var. "
             "Sent as Authorization: Bearer <key>.",
    )
    p.add_argument("--language", default="en")
    p.add_argument("--out-jsonl", default="")
    p.add_argument("--verbose", action="store_true")

    # Preset profile — bundles the config knobs below. Explicit CLI flags override.
    p.add_argument(
        "--preset",
        default=None,
        choices=sorted(PRESETS.keys()),
        help="Preset profile (bundle of config knobs). Explicit --flag overrides win.",
    )

    # Streaming config knobs (query params). Defaults are None so preset can supply them.
    p.add_argument("--itn-normalize", action=argparse.BooleanOptionalAction, default=None)
    p.add_argument("--eou-timeout-ms", type=int, default=None)
    p.add_argument("--endpointing", action=argparse.BooleanOptionalAction, default=None)
    p.add_argument("--max-words", type=int, default=None, help="0 = unset (server default)")
    p.add_argument("--finalize-on-words", action=argparse.BooleanOptionalAction, default=None)
    p.add_argument("--word-timestamps", action=argparse.BooleanOptionalAction, default=None)
    p.add_argument("--keywords", default="")

    # Send-side augmentations.
    p.add_argument("--chunk-ms", type=int, default=40)
    p.add_argument("--jitter", type=int, default=0, help="±ms of per-chunk jitter")
    p.add_argument("--clip-head", type=int, default=0)
    p.add_argument("--clip-tail", type=int, default=0)
    p.add_argument("--snr", type=float, default=None)
    p.add_argument("--bad-resample-hz", type=int, default=0)
    p.add_argument("--force-finalize-after", type=int, default=None)
    p.add_argument("--close-after", type=int, default=None)

    p.add_argument("--recv-timeout", type=float, default=10.0)
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
