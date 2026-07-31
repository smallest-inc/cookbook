"""Smallest.ai Pulse STT integration."""
import logging
import time
import httpx
from typing import Tuple

from .config import SMALLEST_API_KEY, SPEECH_LANGUAGES

logger = logging.getLogger(__name__)

STT_URL = "https://api.smallest.ai/waves/v1/stt/"

# Reused client for connection pooling across requests
_async_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _async_client
    if _async_client is None:
        _async_client = httpx.AsyncClient(timeout=30.0)
    return _async_client


async def close_stt_client() -> None:
    """Close the shared HTTP client. Call on app shutdown."""
    global _async_client
    if _async_client and not _async_client.is_closed:
        await _async_client.aclose()
        _async_client = None


async def transcribe_audio(
    audio_bytes: bytes, language: str, content_type: str = "audio/wav"
) -> Tuple[str, float]:
    """Transcribe audio to text using Pulse STT. Returns (transcription, duration_seconds)."""
    if not SMALLEST_API_KEY:
        raise ValueError("SMALLEST_API_KEY environment variable is not set")
    if language not in SPEECH_LANGUAGES:
        language = "en"

    headers = {
        "Authorization": f"Bearer {SMALLEST_API_KEY}",
        "Content-Type": content_type or "audio/wav",
    }
    params = {"model": "pulse", "language": language}
    client = _get_client()

    start = time.perf_counter()
    try:
        r = await client.post(STT_URL, params=params, headers=headers, content=audio_bytes)
        r.raise_for_status()
    except Exception as exc:
        raise ValueError("Speech recognition failed") from exc
    elapsed = time.perf_counter() - start

    text = r.json().get("transcription", "").strip()
    logger.info("STT transcription took %.2fs for %d bytes", elapsed, len(audio_bytes))
    return text, elapsed
