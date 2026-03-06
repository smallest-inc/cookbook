"""Smallest.ai Pulse STT integration."""
import asyncio
import logging
import time
import httpx
from typing import Tuple

from .config import SMALLEST_API_KEY, SPEECH_LANGUAGES

logger = logging.getLogger(__name__)

STT_URLS = [
    "https://api.smallest.ai/waves/v1/pulse/get_text",
    "https://waves-api.smallest.ai/api/v1/pulse/get_text",
]

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
    """Transcribe audio to text using Pulse STT. Races both URLs, uses first result. Returns (transcription, duration_seconds)."""
    if not SMALLEST_API_KEY:
        raise ValueError("SMALLEST_API_KEY environment variable is not set")
    if language not in SPEECH_LANGUAGES:
        language = "en"

    headers = {
        "Authorization": f"Bearer {SMALLEST_API_KEY}",
        "Content-Type": content_type or "audio/wav",
    }
    params = {"language": language}
    client = _get_client()

    async def _post(url: str) -> Tuple[str, str]:
        r = await client.post(url, params=params, headers=headers, content=audio_bytes)
        r.raise_for_status()
        data = r.json()
        return data.get("transcription", "").strip(), url

    start = time.perf_counter()
    tasks = [asyncio.create_task(_post(url)) for url in STT_URLS]
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    elapsed = time.perf_counter() - start

    for t in done:
        try:
            text, url = t.result()
            logger.info("STT transcription took %.2fs for %d bytes (via %s)", elapsed, len(audio_bytes), url)
            return text, elapsed
        except Exception:
            continue
    raise ValueError("Speech recognition failed")
