"""Smallest.ai Lightning TTS - v3.1 for en/hi/ta/es, v2 for other languages."""
import httpx
from typing import Optional

from .config import SMALLEST_API_KEY, DEFAULT_VOICE_ID, TARGET_LANGUAGES, LIGHTNING_V31_LANGS

# Map our language codes to API voice tags (tags.language)
LANG_TO_VOICE_TAG = {
    "en": "english", "hi": "hindi", "ta": "tamil", "es": "spanish",
    "de": "german", "fr": "french", "it": "italian", "pl": "polish",
    "nl": "dutch", "ru": "russian", "ar": "arabic", "he": "hebrew",
    "bn": "bengali", "gu": "gujarati", "mr": "marathi", "kn": "kannada",
}

# Lightning v3.1: en, hi, ta, es only
V31_LANGS = LIGHTNING_V31_LANGS
V31_URLS = [
    "https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech",
    "https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech",
]
V31_VOICES_URLS = [
    "https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_voices",
    "https://api.smallest.ai/waves/v1/lightning-v3.1/get_voices",
]

# Lightning v2: all other target languages
V2_LANGS = set(TARGET_LANGUAGES.keys()) - V31_LANGS
V2_URLS = [
    "https://waves-api.smallest.ai/api/v1/lightning-v2/get_speech",
    "https://api.smallest.ai/waves/v1/lightning-v2/get_speech",
]
V2_VOICES_URLS = [
    "https://waves-api.smallest.ai/api/v1/lightning-v2/get_voices",
    "https://api.smallest.ai/waves/v1/lightning-v2/get_voices",
]



def _fetch_raw_voices(urls: list) -> list:
    """Fetch raw voices from API (with tags)."""
    if not SMALLEST_API_KEY:
        return []
    headers = {"Authorization": f"Bearer {SMALLEST_API_KEY}"}
    for url in urls:
        try:
            with httpx.Client(timeout=10.0) as client:
                r = client.get(url, headers=headers)
                if r.status_code == 200:
                    return r.json().get("voices", [])
        except Exception:
            continue
    return []


def _voice_supports_language(voice: dict, lang_tag: str) -> bool:
    """Check if voice supports the given language tag."""
    tags = voice.get("tags") or {}
    langs = tags.get("language") or []
    return lang_tag in langs if isinstance(langs, list) else lang_tag == langs


def get_voices(language: str, use_v31: Optional[bool] = None) -> list:
    """Fetch voices for the model that supports the language, filtered by language tag."""
    if use_v31 is None:
        use_v31 = language in V31_LANGS
    raw = _fetch_raw_voices(V31_VOICES_URLS if use_v31 else V2_VOICES_URLS)

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


def _get_valid_voice(language: str, is_v31: bool) -> str:
    """Fetch a valid voice ID for the given model and language."""
    voices = get_voices(language, use_v31=is_v31)
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
    """Generate speech. Uses v3.1 for en/hi/ta/es, v2 for other languages."""
    if not SMALLEST_API_KEY:
        raise ValueError("SMALLEST_API_KEY environment variable is not set")

    lang = language if language in set(TARGET_LANGUAGES.keys()) else "auto"
    use_v31 = lang in V31_LANGS

    if use_v31:
        urls = V31_URLS
        voice_urls = V31_VOICES_URLS
        voice = voice_id or _get_valid_voice(lang or "en", True) or DEFAULT_VOICE_ID
        payload = {
            "text": text,
            "voice_id": voice,
            "language": lang if lang in V31_LANGS else "auto",
            "speed": speed,
            "output_format": output_format,
            "sample_rate": 44100,
        }
    else:
        urls = V2_URLS
        voice_urls = V2_VOICES_URLS
        voice = voice_id or _get_valid_voice(lang or "en", False) or DEFAULT_VOICE_ID
        payload = {
            "text": text,
            "voice_id": voice,
            "language": lang,
            "speed": speed,
            "output_format": output_format,
            "sample_rate": 24000,
            "consistency": 0.5,
            "similarity": 0.0,
            "enhancement": 1,
        }

    headers = {
        "Authorization": f"Bearer {SMALLEST_API_KEY}",
        "Content-Type": "application/json",
    }
    last_error = None
    for tts_url in urls:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(tts_url, json=payload, headers=headers)
                if response.status_code == 400:
                    valid_voice = _get_valid_voice(lang or "en", use_v31)
                    if valid_voice != voice:
                        payload["voice_id"] = valid_voice
                        response = client.post(tts_url, json=payload, headers=headers)
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
