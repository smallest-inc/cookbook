#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Getting Started

The simplest way to transcribe audio using Smallest AI's Pulse STT API.

Usage: python transcribe.py <audio_file>

Output:
- Command line response with transcription
"""

import os
import sys
import requests

API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"

# Features
LANGUAGE = "en"  # Use ISO 639-1 codes or "multi" for auto-detect


def transcribe(audio_file: str, api_key: str) -> dict:
    with open(audio_file, "rb") as f:
        audio_data = f.read()

    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/octet-stream",
        },
        params={
            "language": LANGUAGE,
        },
        data=audio_data,
    )

    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")

    return response.json()


def process_response(result: dict):
    if result.get("status") != "success":
        print(f"Error: Transcription failed")
        print(result)
        sys.exit(1)

    print("\n" + "=" * 60)
    print("TRANSCRIPTION")
    print("=" * 60)
    print(result.get("transcription", ""))
    print("=" * 60 + "\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file>")
        sys.exit(1)

    audio_file = sys.argv[1]
    api_key = os.environ.get("SMALLEST_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    if not os.path.exists(audio_file):
        print(f"Error: File not found: {audio_file}")
        sys.exit(1)

    result = transcribe(audio_file, api_key)
    process_response(result)


if __name__ == "__main__":
    main()
