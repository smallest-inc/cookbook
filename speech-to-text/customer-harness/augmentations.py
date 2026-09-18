"""Pure-function audio augmentations used to reproduce customer-side failures.

All functions operate on int16 mono PCM at a caller-supplied sample rate. No I/O.
"""

from __future__ import annotations

import random
from typing import Iterator

import numpy as np


def _ms_to_samples(ms: int, sample_rate: int) -> int:
    return int(sample_rate * ms / 1000)


def clip_head(pcm: np.ndarray, ms: int, sample_rate: int) -> np.ndarray:
    """Drop the first `ms` of audio to simulate VAD onset clipping."""
    n = _ms_to_samples(ms, sample_rate)
    return pcm[n:] if n < len(pcm) else pcm[:0]


def clip_tail(pcm: np.ndarray, ms: int, sample_rate: int) -> np.ndarray:
    """Drop the last `ms` of audio to simulate VAD offset clipping."""
    n = _ms_to_samples(ms, sample_rate)
    return pcm[:-n] if 0 < n < len(pcm) else (pcm if n == 0 else pcm[:0])


def add_noise(pcm: np.ndarray, snr_db: float) -> np.ndarray:
    """Add white noise at a target signal-to-noise ratio in dB."""
    signal = pcm.astype(np.float32)
    signal_power = float(np.mean(signal**2)) or 1.0
    noise_power = signal_power / (10 ** (snr_db / 10))
    noise = np.random.normal(0.0, np.sqrt(noise_power), size=signal.shape)
    mixed = signal + noise
    return np.clip(mixed, -32768, 32767).astype(np.int16)


def resample_and_back(pcm: np.ndarray, sample_rate: int, target_hz: int) -> np.ndarray:
    """Down/upsample and back to simulate cheap-codec information loss.

    Uses linear interpolation intentionally — a bad resampler is the failure mode.
    """
    if target_hz == sample_rate:
        return pcm
    down_n = int(len(pcm) * target_hz / sample_rate)
    x_down = np.linspace(0, 1, num=len(pcm), endpoint=False)
    x_at = np.linspace(0, 1, num=down_n, endpoint=False)
    down = np.interp(x_at, x_down, pcm.astype(np.float32))
    x_up = np.linspace(0, 1, num=len(down), endpoint=False)
    x_target = np.linspace(0, 1, num=len(pcm), endpoint=False)
    up = np.interp(x_target, x_up, down)
    return np.clip(up, -32768, 32767).astype(np.int16)


def pack_chunks(pcm: np.ndarray, chunk_ms: int, sample_rate: int) -> Iterator[bytes]:
    """Yield binary linear16 chunks a real WebSocket client would send."""
    step = _ms_to_samples(chunk_ms, sample_rate)
    for i in range(0, len(pcm), step):
        yield pcm[i : i + step].astype(np.int16).tobytes()


def jittered_delays(num_chunks: int, chunk_ms: int, jitter_ms: int, seed: int = 0) -> list[float]:
    """Return a list of per-chunk sleep durations (seconds) with random jitter."""
    rng = random.Random(seed)
    base = chunk_ms / 1000.0
    j = jitter_ms / 1000.0
    return [max(0.0, base + rng.uniform(-j, j)) for _ in range(num_chunks)]
