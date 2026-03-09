#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - Getting Started

The simplest way to generate speech using Smallest AI's Lightning TTS API.

Usage: python synthesize.py "Text to speak" [output_file]

Output:
- WAV audio file (default: output.wav)
"""

import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

# Configuration
MODEL = "lightning-v3.1"
VOICE_ID = "sophia"
SPEED = 1.0
SAMPLE_RATE = 24000
LANGUAGE = "en"  # en, hi, es, ta
OUTPUT_FORMAT = "wav"

API_BASE = "https://api.smallest.ai/waves/v1"


def synthesize(text: str, api_key: str) -> bytes:
    response = requests.post(
        f"{API_BASE}/{MODEL}/get_speech",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": VOICE_ID,
            "speed": SPEED,
            "sample_rate": SAMPLE_RATE,
            "language": LANGUAGE,
            "output_format": OUTPUT_FORMAT,
        },
    )

    if response.status_code != 200:
        raise Exception(f"API request failed ({response.status_code}): {response.text}")

    return response.content


def main():
    if len(sys.argv) < 2:
        print("Usage: python synthesize.py \"Text to speak\" [output_file]")
        sys.exit(1)

    text = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "output.wav"
    api_key = os.environ.get("SMALLEST_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    print(f"Generating speech with {MODEL} ({VOICE_ID})...")
    audio = synthesize(text, api_key)

    with open(output_file, "wb") as f:
        f.write(audio)

    print(f"Saved to {output_file} ({len(audio):,} bytes)")


if __name__ == "__main__":
    main()
