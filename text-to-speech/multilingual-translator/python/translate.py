#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - Multilingual Translator

Generate speech in multiple languages from a single input text.
Uses Lightning v3.1 for all supported languages.

Usage:
  python translate.py "Hello world"
  python translate.py "Hello world" --languages hindi spanish

Output:
- One WAV file per language in a translations/ folder
"""

import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_BASE = "https://api.smallest.ai/waves/v1"
MODEL = "lightning-v3.1"
SAMPLE_RATE = 24000

LANGUAGES = {
    "english": {"code": "en", "voice": "sophia"},
    "hindi":   {"code": "hi", "voice": "advika"},
    "spanish": {"code": "es", "voice": "camilla"},
    "tamil":   {"code": "ta", "voice": "anitha"},
}

DEFAULT_LANGUAGES = list(LANGUAGES.keys())


def synthesize(text: str, lang_config: dict, api_key: str) -> bytes:
    response = requests.post(
        f"{API_BASE}/{MODEL}/get_speech",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": lang_config["voice"],
            "language": lang_config["code"],
            "sample_rate": SAMPLE_RATE,
            "output_format": "wav",
        },
    )

    if response.status_code != 200:
        raise Exception(f"API error ({response.status_code}): {response.text}")

    return response.content


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print('Usage: python translate.py "Text to translate" [--languages hindi spanish ...]')
        print(f"\nAvailable: {', '.join(LANGUAGES.keys())}")
        sys.exit(0)

    text = sys.argv[1]
    api_key = os.environ.get("SMALLEST_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    selected = DEFAULT_LANGUAGES
    if "--languages" in sys.argv:
        idx = sys.argv.index("--languages")
        selected = [l.lower() for l in sys.argv[idx + 1:]]
        invalid = [l for l in selected if l not in LANGUAGES]
        if invalid:
            print(f"Unknown language(s): {', '.join(invalid)}")
            print(f"Available: {', '.join(LANGUAGES.keys())}")
            sys.exit(1)

    output_dir = Path("translations")
    output_dir.mkdir(exist_ok=True)

    print(f'Text: "{text}"')
    print(f"Languages: {', '.join(selected)}\n")

    for lang_name in selected:
        config = LANGUAGES[lang_name]
        print(f"  {lang_name:<12} ({config['voice']})...", end=" ", flush=True)

        try:
            audio = synthesize(text, config, api_key)
            filename = output_dir / f"{lang_name}.wav"
            filename.write_bytes(audio)
            print(f"✓ {len(audio):,} bytes → {filename}")
        except Exception as e:
            print(f"✗ {e}")

    print(f"\nDone! Check the {output_dir}/ folder.")


if __name__ == "__main__":
    main()
