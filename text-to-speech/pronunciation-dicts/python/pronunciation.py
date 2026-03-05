#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - Pronunciation Dictionaries

Create custom pronunciation dictionaries and use them when generating speech.
Useful for names, acronyms, and domain-specific terms.

Usage: python pronunciation.py

Output:
- Two WAV files: one without and one with custom pronunciation
"""

import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

MODEL = "lightning-v3.1"
VOICE_ID = "sophia"
SAMPLE_RATE = 24000
API_BASE = "https://api.smallest.ai/waves/v1"

SAMPLE_TEXT = "The Smallest API lets you build voice AI. Ask Diya about GIF support in the SDK."

CUSTOM_PRONUNCIATIONS = [
    {"word": "API", "pronunciation": "ay pee eye"},
    {"word": "Diya", "pronunciation": "dee-yah"},
    {"word": "GIF", "pronunciation": "jiff"},
    {"word": "SDK", "pronunciation": "ess dee kay"},
]


def create_dict(api_key: str) -> str:
    response = requests.post(
        f"{API_BASE}/pronunciation-dicts",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={"items": CUSTOM_PRONUNCIATIONS},
    )

    if response.status_code != 200:
        raise Exception(f"Failed to create dict ({response.status_code}): {response.text}")

    dict_id = response.json()["id"]
    print(f"Created pronunciation dict: {dict_id}")
    for item in CUSTOM_PRONUNCIATIONS:
        print(f"  {item['word']} → {item['pronunciation']}")
    return dict_id


def list_dicts(api_key: str):
    response = requests.get(
        f"{API_BASE}/pronunciation-dicts",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    if response.status_code != 200:
        raise Exception(f"Failed to list dicts ({response.status_code}): {response.text}")

    dicts = response.json()
    print(f"\nYou have {len(dicts)} pronunciation dict(s)")
    for d in dicts:
        print(f"  ID: {d['id']} — {len(d['items'])} entries")


def synthesize(text: str, api_key: str, pronunciation_dicts: list = None) -> bytes:
    payload = {
        "text": text,
        "voice_id": VOICE_ID,
        "sample_rate": SAMPLE_RATE,
        "output_format": "wav",
    }
    if pronunciation_dicts:
        payload["pronunciation_dicts"] = pronunciation_dicts

    response = requests.post(
        f"{API_BASE}/{MODEL}/get_speech",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
    )

    if response.status_code != 200:
        raise Exception(f"Synthesis failed ({response.status_code}): {response.text}")

    return response.content


def delete_dict(dict_id: str, api_key: str):
    response = requests.delete(
        f"{API_BASE}/pronunciation-dicts",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={"id": dict_id},
    )

    if response.status_code != 200:
        raise Exception(f"Failed to delete dict ({response.status_code}): {response.text}")

    print(f"\nDeleted pronunciation dict: {dict_id}")


def main():
    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    print(f'Text: "{SAMPLE_TEXT}"\n')

    # 1. Synthesize without custom pronunciation
    print("Generating without custom pronunciation...")
    audio_default = synthesize(SAMPLE_TEXT, api_key)
    with open("output_default.wav", "wb") as f:
        f.write(audio_default)
    print(f"  Saved to output_default.wav ({len(audio_default):,} bytes)")

    # 2. Create pronunciation dictionary
    print()
    dict_id = create_dict(api_key)

    # 3. List dictionaries
    list_dicts(api_key)

    # 4. Synthesize with custom pronunciation
    print("\nGenerating with custom pronunciation...")
    audio_custom = synthesize(SAMPLE_TEXT, api_key, pronunciation_dicts=[dict_id])
    with open("output_custom.wav", "wb") as f:
        f.write(audio_custom)
    print(f"  Saved to output_custom.wav ({len(audio_custom):,} bytes)")

    # 5. Clean up
    delete_dict(dict_id, api_key)

    print("\nDone! Compare the two files:")
    print("  output_default.wav — default pronunciation")
    print("  output_custom.wav  — custom pronunciation")


if __name__ == "__main__":
    main()
