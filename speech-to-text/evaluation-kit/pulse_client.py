"""Thin client for Smallest AI Pulse STT.

Two transports:
  * stream_transcribe()  -> WebSocket  wss://api.smallest.ai/waves/v1/stt/live   (models: pulse, pulse-2)
  * http_transcribe()    -> HTTP POST  https://api.smallest.ai/waves/v1/stt/     (models: pulse, pulse-pro)

Both return a dict with the joined transcript plus everything needed for scoring
(per-final emotion / gender, end-of-turn events and latency timestamps).
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import time
from urllib.parse import urlencode

import numpy as np
import requests
import soundfile as sf
import websockets

# Override for on-prem / dedicated deployments via env vars.
WS_URL = os.environ.get("SMALLEST_WS_URL", "wss://api.smallest.ai/waves/v1/stt/live")
HTTP_URL = os.environ.get("SMALLEST_HTTP_URL", "https://api.smallest.ai/waves/v1/stt/")

SAMPLE_RATE = 16000
CHUNK_MS = 160


def _bool(v) -> str:
    return "true" if v else "false"


def speech_bounds(audio: np.ndarray, sr: int = SAMPLE_RATE, frame_ms: int = 20) -> tuple[float, float]:
    """Small energy VAD: returns (speech_start_s, speech_end_s) of the clip.

    The threshold adapts to the clip's noise floor, so low-level background
    noise in the lead-in / tail is not counted as speech. Used only to time
    latency and end-of-turn relative to when the speaker starts and stops.
    """
    hop = int(sr * frame_ms / 1000)
    if len(audio) < hop * 5:
        return 0.0, len(audio) / sr
    frames = audio[: len(audio) // hop * hop].reshape(-1, hop)
    db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12))
    floor = np.percentile(db, 10)
    thr = max(db.max() - 35.0, floor + 12.0)
    voiced = db > thr
    # require 3 consecutive voiced frames (60 ms) to count as speech
    run = np.convolve(voiced.astype(int), np.ones(3, dtype=int), mode="same") >= 3
    idx = np.where(run)[0]
    if len(idx) == 0:
        return 0.0, len(audio) / sr
    return max(idx[0] - 1, 0) * hop / sr, (idx[-1] + 2) * hop / sr


def join_finals(finals: list[dict]) -> str:
    """Concatenate final segments as sent. Segments that start a new word carry
    a leading space; a segment without one continues the previous word, so
    adding our own separator would split words ("scra" + "pbook")."""
    text = "".join(f.get("transcript") or "" for f in finals)
    return " ".join(text.split())


async def stream_transcribe(
    audio: np.ndarray,
    api_key: str,
    model: str = "pulse",
    language: str | None = "en",
    realtime: bool = False,
    eot_mode: bool = False,
    trailing_silence_s: float = 2.0,
    extra_params: dict | None = None,
    max_retries: int = 3,
    recv_timeout_s: float = 8.0,
) -> dict:
    """Stream one clip (float32 mono @16 kHz) over the WebSocket.

    realtime=True   paces audio at 1x so latency numbers are meaningful.
    eot_mode=True   (pulse-2) does NOT send `finalize`; instead appends
                    `trailing_silence_s` of silence and lets the built-in
                    end-of-turn model close the turn, then sends close_stream.
    """
    params = {"model": model, "encoding": "linear16", "sample_rate": SAMPLE_RATE}
    if language:
        params["language"] = language
    for k, v in (extra_params or {}).items():
        params[k] = _bool(v) if isinstance(v, bool) else v
    url = f"{WS_URL}?{urlencode(params)}"

    chunk = int(SAMPLE_RATE * CHUNK_MS / 1000)
    if eot_mode:
        audio = np.concatenate([audio, np.zeros(int(trailing_silence_s * SAMPLE_RATE), dtype=np.float32)])
    pcm = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)

    last_err = None
    for attempt in range(max_retries + 1):
        finals: list[dict] = []
        events: list[dict] = []
        first_partial_t = None
        try:
            async with websockets.connect(
                url,
                additional_headers={"Authorization": f"Bearer {api_key}"},
                open_timeout=15,
                max_size=None,
            ) as ws:
                t0 = time.perf_counter()

                async def sender():
                    for i, off in enumerate(range(0, len(pcm), chunk)):
                        if realtime:
                            target = t0 + i * CHUNK_MS / 1000
                            delay = target - time.perf_counter()
                            if delay > 0:
                                await asyncio.sleep(delay)
                        await ws.send(pcm[off: off + chunk].tobytes())
                    if not eot_mode:
                        await ws.send(json.dumps({"type": "finalize"}))
                    await ws.send(json.dumps({"type": "close_stream"}))

                send_task = asyncio.create_task(sender())
                try:
                    while True:
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=recv_timeout_s)
                        except asyncio.TimeoutError:
                            if send_task.done():
                                break
                            continue
                        except websockets.exceptions.ConnectionClosedOK:
                            break
                        t = time.perf_counter() - t0
                        if isinstance(msg, bytes):
                            continue
                        data = json.loads(msg)
                        if data.get("error") or data.get("type") == "error":
                            raise RuntimeError(f"server error: {data}")
                        mtype = data.get("type", "transcription")
                        if mtype in ("speech_started", "speech_ended"):
                            events.append({"type": mtype, "t": t})
                            continue
                        text = data.get("transcript") or ""
                        if not data.get("is_final"):
                            if first_partial_t is None and text.strip():
                                first_partial_t = t
                            continue
                        if first_partial_t is None and text.strip():
                            first_partial_t = t
                        words = data.get("words") or []
                        finals.append({
                            "t": t,
                            "word_start": words[0].get("start") if words else None,
                            "word_end": words[-1].get("end") if words else None,
                            "transcript": text,
                            "eot_finalized": bool(data.get("eot_finalized")),
                            "is_last": bool(data.get("is_last")),
                            "emotion": data.get("emotion"),
                            "gender": data.get("gender"),
                        })
                        if data.get("is_last"):
                            break
                finally:
                    if not send_task.done():
                        send_task.cancel()
                    else:
                        exc = send_task.exception()
                        if exc and not isinstance(exc, websockets.exceptions.ConnectionClosed):
                            raise exc

            transcript = join_finals(finals)
            return {"transcript": transcript, "finals": finals, "events": events,
                    "first_partial_t": first_partial_t}
        except (websockets.exceptions.WebSocketException, RuntimeError, OSError) as e:
            last_err = e
            if attempt < max_retries:
                await asyncio.sleep(1.5 * (2 ** attempt))
                continue
    raise RuntimeError(f"streaming failed after {max_retries + 1} attempts: {last_err}")


def http_transcribe(audio: np.ndarray, api_key: str, model: str = "pulse-pro",
                    language: str | None = "en", extra_params: dict | None = None,
                    max_retries: int = 3, timeout_s: int = 300) -> dict:
    """Pre-recorded transcription: POST the clip as a 16 kHz WAV."""
    buf = io.BytesIO()
    sf.write(buf, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    body = buf.getvalue()
    params = {"model": model}
    if language:
        params["language"] = language
    params.update({k: (_bool(v) if isinstance(v, bool) else v) for k, v in (extra_params or {}).items()})
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/octet-stream"}

    last_err = None
    for attempt in range(max_retries + 1):
        try:
            t0 = time.perf_counter()
            r = requests.post(HTTP_URL, params=params, headers=headers, data=body, timeout=timeout_s)
            elapsed = time.perf_counter() - t0
            if r.status_code == 429 or r.status_code >= 500:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
            r.raise_for_status()
            data = r.json()
            return {"transcript": (data.get("transcription") or "").strip(),
                    "finals": [], "events": [], "first_partial_t": None,
                    "request_s": elapsed, "raw_metadata": data.get("metadata")}
        except (requests.RequestException, RuntimeError, ValueError) as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(1.5 * (2 ** attempt))
                continue
    raise RuntimeError(f"HTTP transcription failed after {max_retries + 1} attempts: {last_err}")
