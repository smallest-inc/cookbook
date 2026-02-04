#!/usr/bin/env python3
"""
Basic Audio Transcription with Pulse STT REST API

Usage:
    python basic_transcription.py path/to/audio.wav
    python basic_transcription.py path/to/audio.mp3 --language es

Requirements:
    pip install requests
"""

import os
import sys
import argparse
import requests
from typing import Optional


def transcribe_audio_file(
    file_path: str,
    language: str = "en",
    word_timestamps: bool = True
) -> dict:
    """
    Transcribe a local audio file using Smallest AI Pulse STT.
    Supports WAV, MP3, FLAC, and most common audio formats.
    """
    api_key = os.getenv("SMALLEST_API_KEY")
    if not api_key:
        raise ValueError("SMALLEST_API_KEY environment variable not set")

    url = "https://waves-api.smallest.ai/api/v1/pulse/get_text"

    # Determine content type based on file extension
    ext = file_path.lower().split('.')[-1]
    content_types = {
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg',
        'flac': 'audio/flac',
        'm4a': 'audio/mp4',
        'webm': 'audio/webm',
        'ogg': 'audio/ogg'
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": content_types.get(ext, "audio/wav")
    }

    params = {
        "model": "pulse",
        "language": language,
        "word_timestamps": str(word_timestamps).lower()
    }

    print(f"📁 Reading: {file_path}")
    print(f"🌐 Language: {language}")
    print(f"⏱️  Timestamps: {word_timestamps}")
    print()

    with open(file_path, "rb") as audio_file:
        response = requests.post(
            url,
            headers=headers,
            params=params,
            data=audio_file.read(),
            timeout=120  # Longer timeout for large files
        )

    if not response.ok:
        print(f"❌ Error: HTTP {response.status_code}")
        print(response.text)
        sys.exit(1)

    return response.json()


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with Pulse STT")
    parser.add_argument("file", help="Path to audio file")
    parser.add_argument("--language", "-l", default="en",
                        help="Language code (en, hi, es, multi for auto-detect)")
    parser.add_argument("--no-timestamps", action="store_true",
                        help="Disable word timestamps")

    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"❌ File not found: {args.file}")
        sys.exit(1)

    result = transcribe_audio_file(
        args.file,
        language=args.language,
        word_timestamps=not args.no_timestamps
    )

    print("=" * 60)
    print("📝 TRANSCRIPTION")
    print("=" * 60)
    print(result.get('transcription', '(no transcription)'))
    print()

    # Print word timestamps if available
    words = result.get('words', [])
    if words:
        print("=" * 60)
        print("⏱️  WORD TIMESTAMPS")
        print("=" * 60)
        for word in words:
            print(f"  [{word['start']:6.2f}s - {word['end']:6.2f}s] {word['word']}")

    # Print metadata if available
    metadata = result.get('metadata', {})
    if metadata:
        print()
        print(f"📊 Duration: {metadata.get('duration', 'N/A')}s")
        print(f"📊 File size: {metadata.get('fileSize', 'N/A')} bytes")


if __name__ == "__main__":
    main()
