#!/usr/bin/env python3
"""
Transcribe Audio from URL with Pulse STT REST API

Usage:
    python url_transcription.py "https://example.com/audio.mp3"

Requirements:
    pip install requests
"""

import os
import sys
import argparse
import requests


def transcribe_from_url(audio_url: str, language: str = "en") -> dict:
    """Transcribe audio from a remote URL."""
    api_key = os.getenv("SMALLEST_API_KEY")
    if not api_key:
        raise ValueError("SMALLEST_API_KEY environment variable not set")

    url = "https://waves-api.smallest.ai/api/v1/pulse/get_text"

    print(f"🔗 URL: {audio_url}")
    print(f"🌐 Language: {language}")
    print()
    print("⏳ Transcribing...")

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        params={
            "model": "pulse",
            "language": language,
            "word_timestamps": "true"
        },
        json={"url": audio_url},
        timeout=120
    )

    if not response.ok:
        print(f"❌ Error: HTTP {response.status_code}")
        print(response.text)
        sys.exit(1)

    return response.json()


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio from URL")
    parser.add_argument("url", help="URL to audio file")
    parser.add_argument("--language", "-l", default="en",
                        help="Language code (en, hi, es, multi for auto-detect)")

    args = parser.parse_args()

    result = transcribe_from_url(args.url, language=args.language)

    print()
    print("=" * 60)
    print("📝 TRANSCRIPTION")
    print("=" * 60)
    print(result.get('transcription', '(no transcription)'))

    # Print utterances if available
    utterances = result.get('utterances', [])
    if utterances:
        print()
        print("=" * 60)
        print("📜 UTTERANCES")
        print("=" * 60)
        for utt in utterances:
            print(f"  [{utt['start']:6.2f}s - {utt['end']:6.2f}s] {utt['text']}")


if __name__ == "__main__":
    main()
