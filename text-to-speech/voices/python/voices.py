#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - Voice Explorer

List available TTS voices, filter by language/gender/accent, and preview any voice.

Usage:
  python voices.py                             # List all voices
  python voices.py --language english          # Filter by language
  python voices.py --gender female             # Filter by gender
  python voices.py --accent american           # Filter by accent
  python voices.py --preview sophia             # Generate preview for a voice

Output:
- Table of available voices
- Optional preview WAV file
"""

import argparse
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

MODEL = "lightning-v3.1"
API_BASE = "https://api.smallest.ai/waves/v1"
PREVIEW_TEXT = "Hello! This is a preview of my voice. I can speak naturally with great clarity and expression."


def get_voices(api_key: str, model: str = MODEL) -> list:
    response = requests.get(
        f"{API_BASE}/{model}/get_voices",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    if response.status_code != 200:
        raise Exception(f"API request failed ({response.status_code}): {response.text}")

    data = response.json()
    return data.get("voices", data) if isinstance(data, dict) else data


def filter_voices(voices: list, language: str = None, gender: str = None, accent: str = None) -> list:
    filtered = voices
    if language:
        filtered = [
            v for v in filtered
            if language.lower() in [lang.lower() for lang in v.get("tags", {}).get("language", [])]
        ]
    if gender:
        filtered = [
            v for v in filtered
            if v.get("tags", {}).get("gender", "").lower() == gender.lower()
        ]
    if accent:
        filtered = [
            v for v in filtered
            if accent.lower() in v.get("tags", {}).get("accent", "").lower()
        ]
    return filtered


def print_voices(voices: list):
    if not voices:
        print("No voices found matching your criteria.")
        return

    print(f"\n{'Voice ID':<20} {'Name':<20} {'Gender':<10} {'Languages':<25} {'Accent'}")
    print("-" * 90)

    for v in voices:
        tags = v.get("tags", {})
        voice_id = v.get("voiceId", "")
        name = v.get("displayName", "")
        gender = tags.get("gender", "—")
        languages = ", ".join(tags.get("language", []))
        accent = tags.get("accent", "—")
        print(f"{voice_id:<20} {name:<20} {gender:<10} {languages:<25} {accent}")

    print(f"\nTotal: {len(voices)} voice(s)")


def preview_voice(voice_id: str, api_key: str, model: str = MODEL):
    print(f"Generating preview for '{voice_id}'...")

    response = requests.post(
        f"{API_BASE}/{model}/get_speech",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": PREVIEW_TEXT,
            "voice_id": voice_id,
            "sample_rate": 24000,
            "speed": 1.0,
            "output_format": "wav",
        },
    )

    if response.status_code != 200:
        raise Exception(f"API request failed ({response.status_code}): {response.text}")

    filename = f"preview_{voice_id}.wav"
    with open(filename, "wb") as f:
        f.write(response.content)

    print(f"Saved to {filename} ({len(response.content):,} bytes)")


def main():
    parser = argparse.ArgumentParser(description="Explore Smallest AI TTS voices")
    parser.add_argument("--model", default=MODEL, help="TTS model (default: lightning-v3.1)")
    parser.add_argument("--language", help="Filter by language (e.g. english, hindi)")
    parser.add_argument("--gender", help="Filter by gender (male/female)")
    parser.add_argument("--accent", help="Filter by accent (e.g. american, british)")
    parser.add_argument("--preview", metavar="VOICE_ID", help="Generate a preview for a voice")
    args = parser.parse_args()

    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    if args.preview:
        preview_voice(args.preview, api_key, args.model)
        return

    voices = get_voices(api_key, args.model)
    voices = filter_voices(voices, args.language, args.gender, args.accent)
    print_voices(voices)


if __name__ == "__main__":
    main()
