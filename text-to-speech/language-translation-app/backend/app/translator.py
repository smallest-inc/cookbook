"""Translation using deep-translator (Google - free, no API key)."""
from typing import Optional
from deep_translator import GoogleTranslator


def translate_text(text: str, from_code: str, to_code: str) -> Optional[str]:
    """Translate text from source to target language."""
    if from_code == to_code:
        return text
    try:
        translator = GoogleTranslator(source=from_code, target=to_code)
        return translator.translate(text)
    except Exception:
        return None
