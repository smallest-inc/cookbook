"""App configuration."""
import os
from pathlib import Path

# Load .env from backend/ or project root
for _p in [Path(__file__).parent.parent / ".env", Path(__file__).parent.parent.parent / ".env"]:
    if _p.exists():
        from dotenv import load_dotenv
        load_dotenv(_p)
        break

# Lightning v3.1: only en, hi, ta, es. Other languages use Lightning v2.
LIGHTNING_V31_LANGS = {"en", "hi", "ta", "es"}

# Target languages: translation + TTS - 16 languages
TARGET_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "kn": "Kannada",
    "gu": "Gujarati",
    "bn": "Bengali",
    "mr": "Marathi",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "it": "Italian",
    "pl": "Polish",
    "nl": "Dutch",
    "ru": "Russian",
    "ar": "Arabic",
    "he": "Hebrew",
}

# Source languages: broader set for input (Google Translate supports 100+)
SOURCE_LANGUAGES = {
    **TARGET_LANGUAGES,
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "tr": "Turkish",
    "uk": "Ukrainian",
    "sv": "Swedish",
    "cs": "Czech",
    "el": "Greek",
    "hu": "Hungarian",
    "ro": "Romanian",
    "da": "Danish",
    "fi": "Finnish",
    "no": "Norwegian",
    "bg": "Bulgarian",
    "hr": "Croatian",
    "sk": "Slovak",
    "tl": "Filipino",
}

# Speech input: intersection of Pulse STT and Lightning v2 TTS
SPEECH_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "kn": "Kannada",
    "gu": "Gujarati",
    "bn": "Bengali",
    "mr": "Marathi",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "it": "Italian",
    "pl": "Polish",
    "nl": "Dutch",
    "ru": "Russian",
    "sv": "Swedish",
}

SUPPORTED_LANGUAGES = TARGET_LANGUAGES

SMALLEST_API_KEY = os.getenv("SMALLEST_API_KEY", "")
DEFAULT_VOICE_ID = "emily"
