#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Word-Level Outputs

Transcribe audio with word-level timestamps and speaker diarization,
showing timing and speaker information for each word and utterance.

Usage: python transcribe.py <audio_file>

Output:
- Command line response with word timestamps and utterances
- {filename}_result.json - Full result with words and utterances
"""

import json
import os
import sys
from pathlib import Path

import requests

API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"

LANGUAGE = "en"  # Use ISO 639-1 codes or "multi" for auto-detect
WORD_TIMESTAMPS = True
DIARIZE = True


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
            "word_timestamps": str(WORD_TIMESTAMPS).lower(),
            "diarize": str(DIARIZE).lower(),
        },
        data=audio_data,
        timeout=300,
    )

    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")

    return response.json()

# This function is designed to process feature outputs ONLY for word-level timestamps and speaker diarization
def process_response(result: dict, audio_path: Path):
    if result.get("status") != "success":
        print("Error: Transcription failed")
        print(result)
        sys.exit(1)

    print("\n" + "=" * 60)
    print("TRANSCRIPTION")
    print("=" * 60)
    print(result.get("transcription", ""))

    # Utterances (speaker diarization)
    utterances = result.get("utterances", [])
    if utterances:
        print("\n" + "-" * 60)
        print("UTTERANCES")
        print("-" * 60)
        for utt in utterances:
            speaker = utt.get("speaker", "")
            start = utt.get("start", 0)
            end = utt.get("end", 0)
            text = utt.get("text", "")
            if speaker:
                print(f"[{start:.2f}s - {end:.2f}s] {speaker}: {text}")
            else:
                print(f"[{start:.2f}s - {end:.2f}s] {text}")

    # Word timestamps
    words = result.get("words", [])
    if words:
        print("\n" + "-" * 60)
        print("WORD TIMESTAMPS")
        print("-" * 60)
        for word in words:
            start = word.get("start", 0)
            end = word.get("end", 0)
            text = word.get("word", "")
            speaker = word.get("speaker", "")
            if speaker:
                print(f"[{start:.2f}s - {end:.2f}s] {speaker}: {text}")
            else:
                print(f"[{start:.2f}s - {end:.2f}s] {text}")

    print("\n" + "=" * 60)

    json_path = Path(".") / f"{audio_path.stem}_result.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Saved: {json_path}")
    print("Done!")


def main():
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file>")
        sys.exit(1)

    audio_file = sys.argv[1]
    api_key = os.environ.get("SMALLEST_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    audio_path = Path(audio_file)
    if not audio_path.exists():
        print(f"Error: File not found: {audio_file}")
        sys.exit(1)

    print(f"Transcribing: {audio_path.name}")

    result = transcribe(audio_file, api_key)
    process_response(result, audio_path)


if __name__ == "__main__":
    main()
