#!/usr/bin/env python3
"""
Expressive TTS — Generate speech with emotion, pitch, volume, prosody, and accent.

Uses Lightning v3.2 on waves-api.smallest.ai.

Usage:
    python expressive.py                           # Generate all demo samples
    python expressive.py --emotion angry --text "This is unacceptable!"
    python expressive.py --emotion calm --volume whispering --accent british --text "Shh..."
"""

import argparse
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://waves-api.smallest.ai/api/v1/lightning-v3.2/get_speech"
SAMPLE_RATE = 44100  # v3.2 uses 44100, NOT 24000


def synthesize(text, voice_id="natalie", emotion="neutral", pitch="mid-range",
               volume="normal", prosody="normal", accent="general american",
               api_key=None):
    """Generate expressive speech. Returns audio bytes."""
    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": voice_id,
            "emotion": emotion,
            "pitch": pitch,
            "volume": volume,
            "prosody": prosody,
            "accent": accent,
            "sample_rate": SAMPLE_RATE,
            "output_format": "wav",
        },
    )
    if response.status_code != 200:
        raise Exception(f"API error ({response.status_code}): {response.text}")
    return response.content


# Demo samples — showcases the range of expressive controls
DEMOS = [
    {
        "name": "happy_excited",
        "text": "Oh my goodness, I just got the best news ever! This is absolutely incredible!",
        "emotion": "excited", "pitch": "high-pitched", "volume": "normal", "prosody": "fast",
    },
    {
        "name": "sad_slow",
        "text": "Everything we built together... it's all just gone now. I don't know what to do.",
        "emotion": "sad", "pitch": "low-pitched", "volume": "soft", "prosody": "slow",
    },
    {
        "name": "angry_british",
        "text": "This is absolutely unacceptable! How could you possibly let this happen?",
        "emotion": "angry", "pitch": "mid-range", "volume": "loud", "prosody": "normal",
        "accent": "british",
    },
    {
        "name": "sarcastic",
        "text": "Oh sure, what could possibly go wrong? Everything always works out perfectly.",
        "emotion": "sarcastic", "pitch": "mid-range", "volume": "normal", "prosody": "measured",
    },
    {
        "name": "anxious_whisper",
        "text": "Shh... did you hear that? I think there's someone outside the window.",
        "emotion": "anxious", "pitch": "high-pitched", "volume": "whispering", "prosody": "hesitant",
    },
    {
        "name": "confident_presenter",
        "text": "Welcome everyone to our product launch! Today, we're going to change everything.",
        "emotion": "confident", "pitch": "mid-range", "volume": "normal", "prosody": "melodic",
    },
]


def main():
    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: set SMALLEST_API_KEY environment variable")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Expressive TTS (Lightning v3.2)")
    parser.add_argument("--text", help="Text to synthesize (runs all demos if omitted)")
    parser.add_argument("--emotion", default="neutral")
    parser.add_argument("--pitch", default="mid-range")
    parser.add_argument("--volume", default="normal")
    parser.add_argument("--prosody", default="normal")
    parser.add_argument("--accent", default="general american")
    parser.add_argument("--voice", default="natalie")
    parser.add_argument("--output", "-o", default=None)
    args = parser.parse_args()

    os.makedirs("output", exist_ok=True)

    if args.text:
        # Single generation
        output_file = args.output or f"output/{args.emotion}_{args.volume}_{args.prosody}.wav"
        print(f"Generating: {args.emotion}, {args.volume}, {args.prosody}, {args.accent}")
        audio = synthesize(
            args.text, voice_id=args.voice, emotion=args.emotion,
            pitch=args.pitch, volume=args.volume, prosody=args.prosody,
            accent=args.accent, api_key=api_key,
        )
        with open(output_file, "wb") as f:
            f.write(audio)
        print(f"  Saved {output_file} ({len(audio):,} bytes)")
    else:
        # Run all demos
        print(f"Generating {len(DEMOS)} expressive demos...\n")
        for demo in DEMOS:
            name = demo["name"]
            output_file = f"output/{name}.wav"
            print(f"  {name}: {demo['emotion']}, {demo.get('volume', 'normal')}, {demo.get('prosody', 'normal')}")
            try:
                audio = synthesize(
                    demo["text"],
                    emotion=demo.get("emotion", "neutral"),
                    pitch=demo.get("pitch", "mid-range"),
                    volume=demo.get("volume", "normal"),
                    prosody=demo.get("prosody", "normal"),
                    accent=demo.get("accent", "general american"),
                    api_key=api_key,
                )
                with open(output_file, "wb") as f:
                    f.write(audio)
                print(f"    -> {output_file} ({len(audio):,} bytes)")
            except Exception as e:
                print(f"    -> ERROR: {e}")
        print(f"\nDone! Check the output/ folder.")


if __name__ == "__main__":
    main()
