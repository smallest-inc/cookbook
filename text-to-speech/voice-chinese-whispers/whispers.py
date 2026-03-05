#!/usr/bin/env python3
"""
Voice Chinese Whispers (Telephone Game)

Same sentence, different characters — each with unique emotion, accent, volume,
and speaking style. Generates individual files + a combined audio.

Uses Lightning v3.2 expressive TTS.

Usage:
    python whispers.py
    python whispers.py "The quarterly earnings report is devastating"
    python whispers.py --characters custom.json "Hello world"
"""

import argparse
import json
import os
import struct
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://waves-api.smallest.ai/api/v1/lightning-v3.2/get_speech"
SAMPLE_RATE = 44100

DEFAULT_TEXT = "I just found out that we're getting a brand new office, and honestly I have some very strong feelings about it."

DEFAULT_CHARACTERS = [
    {
        "name": "Excited American",
        "emoji": "😊",
        "emotion": "excited",
        "pitch": "high-pitched",
        "volume": "loud",
        "prosody": "fast",
        "accent": "general american",
    },
    {
        "name": "Sarcastic Brit",
        "emoji": "🇬🇧",
        "emotion": "sarcastic",
        "pitch": "mid-range",
        "volume": "normal",
        "prosody": "measured",
        "accent": "british",
    },
    {
        "name": "Anxious Whisperer",
        "emoji": "😰",
        "emotion": "anxious",
        "pitch": "high-pitched",
        "volume": "whispering",
        "prosody": "hesitant",
        "accent": "general american",
    },
    {
        "name": "Angry New Yorker",
        "emoji": "😤",
        "emotion": "angry",
        "pitch": "mid-range",
        "volume": "shouting",
        "prosody": "fast",
        "accent": "new york",
    },
    {
        "name": "Calm Storyteller",
        "emoji": "🧘",
        "emotion": "calm",
        "pitch": "low-pitched",
        "volume": "soft",
        "prosody": "melodic",
        "accent": "australian",
    },
]


def synthesize(text, character, api_key):
    """Generate speech for one character."""
    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": "natalie",
            "emotion": character.get("emotion", "neutral"),
            "pitch": character.get("pitch", "mid-range"),
            "volume": character.get("volume", "normal"),
            "prosody": character.get("prosody", "normal"),
            "accent": character.get("accent", "general american"),
            "sample_rate": SAMPLE_RATE,
            "output_format": "wav",
        },
    )
    if response.status_code != 200:
        raise Exception(f"API error ({response.status_code}): {response.text}")
    return response.content


def extract_pcm(wav_bytes):
    """Extract raw PCM data from WAV file bytes (skip 44-byte header)."""
    if wav_bytes[:4] == b"RIFF":
        return wav_bytes[44:]
    return wav_bytes


def combine_wavs(pcm_chunks, output_file, pause_seconds=0.8):
    """Combine multiple PCM chunks into a single WAV with pauses between them."""
    silence = b"\x00\x00" * int(SAMPLE_RATE * pause_seconds)  # 16-bit silence

    combined = b""
    for i, chunk in enumerate(pcm_chunks):
        combined += chunk
        if i < len(pcm_chunks) - 1:
            combined += silence

    # Write WAV header + combined PCM
    data_size = len(combined)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16,
        b"data", data_size,
    )

    with open(output_file, "wb") as f:
        f.write(header + combined)


def main():
    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: set SMALLEST_API_KEY environment variable")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Voice Chinese Whispers")
    parser.add_argument("text", nargs="?", default=DEFAULT_TEXT, help="Text to pass through characters")
    parser.add_argument("--characters", help="JSON file with custom character definitions")
    parser.add_argument("--voice", default="natalie", help="Voice ID to use")
    args = parser.parse_args()

    characters = DEFAULT_CHARACTERS
    if args.characters:
        with open(args.characters) as f:
            characters = json.load(f)

    os.makedirs("output", exist_ok=True)

    print(f"Voice Chinese Whispers")
    print(f"Text: \"{args.text[:80]}{'...' if len(args.text) > 80 else ''}\"")
    print(f"Characters: {len(characters)}")
    print()

    pcm_chunks = []

    for i, char in enumerate(characters, 1):
        name = char.get("name", f"Character {i}")
        emoji = char.get("emoji", "🎭")
        style = f"{char.get('emotion', 'neutral')}, {char.get('volume', 'normal')}, {char.get('accent', 'general american')}"

        print(f"  Round {i}: {emoji} {name}")
        print(f"    Style: {style}")

        try:
            audio = synthesize(args.text, char, api_key)
            pcm = extract_pcm(audio)
            pcm_chunks.append(pcm)

            # Save individual file
            slug = name.lower().replace(" ", "_")
            filename = f"output/{i}_{slug}.wav"
            with open(filename, "wb") as f:
                f.write(audio)
            print(f"    Saved: {filename} ({len(audio):,} bytes)")
        except Exception as e:
            print(f"    ERROR: {e}")

    # Combine all rounds
    if pcm_chunks:
        combined_file = "output/chinese_whispers_combined.wav"
        combine_wavs(pcm_chunks, combined_file)
        print(f"\n  Combined: {combined_file}")

    print(f"\nDone! Listen to all {len(pcm_chunks)} rounds in the output/ folder.")
    print("Share the combined file — people love hearing the same sentence in different styles!")


if __name__ == "__main__":
    main()
