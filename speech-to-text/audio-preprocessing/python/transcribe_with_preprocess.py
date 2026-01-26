#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Transcribe with Preprocessing

Preprocesses audio file and transcribes with Pulse STT in one step.

Usage: python transcribe_with_preprocess.py <audio_file>

Requirements:
- FFmpeg installed
- requests: pip install requests

Output:
- Console output with transcription
- {filename}_transcript.txt
"""

import os
import sys
import tempfile
from pathlib import Path

import requests

from preprocess import preprocess_audio, get_audio_info, check_ffmpeg

API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"
LANGUAGE = "en"


def transcribe_bytes(audio_data: bytes, api_key: str) -> dict:
    """Send audio bytes to Pulse STT API."""
    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "audio/wav",
        },
        params={
            "model": "pulse",
            "language": LANGUAGE,
        },
        data=audio_data,
    )

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code} - {response.text}")

    return response.json()


def main():
    if len(sys.argv) < 2:
        print("Usage: python transcribe_with_preprocess.py <audio_file>")
        sys.exit(1)

    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    check_ffmpeg()

    input_file = Path(sys.argv[1])

    if not input_file.exists():
        print(f"Error: File not found: {input_file}")
        sys.exit(1)

    print(f"\nInput: {input_file}")
    info = get_audio_info(str(input_file))

    if "error" in info:
        print(f"Error: {info['error']}")
        sys.exit(1)

    print(f"  Original: {info['sample_rate']} Hz, {info['channels']} channels, {info['codec']}")

    # Preprocess audio (fall back to original if it fails)
    print(f"\nPreprocessing...")
    processed_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            processed_path = tmp.name

        preprocess_audio(str(input_file), processed_path)

        processed_info = get_audio_info(processed_path)
        print(f"  Processed: {processed_info['sample_rate']} Hz, {processed_info['channels']} channel")

        with open(processed_path, "rb") as f:
            audio_data = f.read()

    except Exception as e:
        print(f"  Preprocessing failed: {e}")
        print(f"  Falling back to original file...")

        with open(input_file, "rb") as f:
            audio_data = f.read()

    finally:
        if processed_path and os.path.exists(processed_path):
            os.remove(processed_path)

    print(f"\nTranscribing...")
    result = transcribe_bytes(audio_data, api_key)

    transcript = result.get("transcript", "") or result.get("transcription", "")

    print("\n" + "=" * 60)
    print("TRANSCRIPTION")
    print("=" * 60)
    print(transcript)
    print("=" * 60)

    output_file = input_file.parent / f"{input_file.stem}_transcript.txt"
    with open(output_file, "w") as f:
        f.write(transcript)
    print(f"\nSaved: {output_file}")


if __name__ == "__main__":
    main()
