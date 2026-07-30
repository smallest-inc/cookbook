"""Smallest.ai Lightning TTS via the unified /waves/v1/tts endpoint."""
import httpx
from typing import Optional

from .config import SMALLEST_API_KEY, DEFAULT_VOICE_ID, TARGET_LANGUAGES

# Map our language codes to API voice tags (tags.language)
LANG_TO_VOICE_TAG = {
    "en": "english", "hi": "hindi", "ta": "tamil", "es": "spanish",
    "de": "german", "fr": "french", "it": "italian", "pl": "polish",
    "nl": "dutch", "ru": "russian", "ar": "arabic",
    "bn": "bengali", "gu": "gujarati", "mr": "marathi", "kn": "kannada",
}

TTS_URL = "https://api.smallest.ai/waves/v1/tts"
VOICES_URL = "https://api.smallest.ai/waves/v1/lightning-v3.1/get_voices"


def _fetch_raw_voices() -> list:
    """Fetch raw voices from API (with tags)."""
    if not SMALLEST_API_KEY:
        return []
    headers = {"Authorization": f"Bearer {SMALLEST_API_KEY}"}
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(VOICES_URL, headers=headers)
            if r.status_code == 200:
                return r.json().get("voices", [])
    except Exception:
        pass
    return []


def _voice_supports_language(voice: dict, lang_tag: str) -> bool:
    """Check if voice supports the given language tag."""
    tags = voice.get("tags") or {}
    langs = tags.get("language") or []
    return lang_tag in langs if isinstance(langs, list) else lang_tag == langs


def get_voices(language: str) -> list:
    """Fetch voices filtered by language tag."""
    raw = _fetch_raw_voices()

    lang_tag = LANG_TO_VOICE_TAG.get(language, "english")
    filtered = [v for v in raw if _voice_supports_language(v, lang_tag)]

    # Fallback: if no voices match, return all (e.g. unknown language)
    voices = filtered if filtered else raw

    return [
        {
            "voiceId": v.get("voiceId") or v.get("voice_id"),
            "displayName": v.get("displayName") or v.get("display_name", "Unknown"),
        }
        for v in voices
        if v.get("voiceId") or v.get("voice_id")
    ]


def _get_valid_voice(language: str) -> str:
    """Fetch a valid voice ID for the given language."""
    voices = get_voices(language)
    if voices:
        return voices[0]["voiceId"]
    return DEFAULT_VOICE_ID


def synthesize_speech(
    text: str,
    language: str = "auto",
    voice_id: Optional[str] = None,
    speed: float = 1.0,
    output_format: str = "wav",
) -> Optional[bytes]:
    """Generate speech with Lightning v3.1 on the unified TTS endpoint."""
    if not SMALLEST_API_KEY:
        raise ValueError("SMALLEST_API_KEY environment variable is not set")

    lang = language if language in set(TARGET_LANGUAGES.keys()) else "auto"
    voice = voice_id or _get_valid_voice(lang if lang != "auto" else "en") or DEFAULT_VOICE_ID
    payload = {
        "text": text,
        "voice_id": voice,
        "model": "lightning_v3.1",
        "language": lang,
        "speed": speed,
        "output_format": output_format,
        "sample_rate": 24000,
    }

    headers = {
        "Authorization": f"Bearer {SMALLEST_API_KEY}",
        "Content-Type": "application/json",
    }
    last_error = None
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(TTS_URL, json=payload, headers=headers)
            if response.status_code == 400:
                valid_voice = _get_valid_voice(lang if lang != "auto" else "en")
                if valid_voice != voice:
                    payload["voice_id"] = valid_voice
                    response = client.post(TTS_URL, json=payload, headers=headers)
            if response.status_code == 200:
                return response.content
            err = response.text
            try:
                j = response.json()
                err = j.get("message", j.get("error", err))
            except Exception:
                pass
            last_error = err
    except httpx.HTTPError as e:
        last_error = str(e)
    raise ValueError(last_error or "TTS request failed")
