#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - File Transcription

Transcribe audio files with advanced features like word timestamps,
speaker diarization, and emotion detection.

Usage: python transcribe.py <audio_file>

Output:
- Command line response with feature outputs
- {filename}_transcript.txt - Plain text transcription
- {filename}_result.json - Full API response
"""

import json
import os
import sys
from pathlib import Path

import requests

API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"
OUTPUT_DIR = "."

# The following are all the features supported by the POST endpoint (Pre-Recorded API)
LANGUAGE = "en"  # Use ISO 639-1 codes or "multi" for auto-detect
WORD_TIMESTAMPS = False
DIARIZE = False
AGE_DETECTION = False
GENDER_DETECTION = False
EMOTION_DETECTION = False


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
            "age_detection": str(AGE_DETECTION).lower(),
            "gender_detection": str(GENDER_DETECTION).lower(),
            "emotion_detection": str(EMOTION_DETECTION).lower(),
        },
        data=audio_data,
        timeout=300,
    )

    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")

    return response.json()

# This function is designed to process feature outputs for all the features supported
# by the POST endpoint (Pre-Recorded API)
def process_response(result: dict, audio_path: Path):
    if result.get("status") != "success":
        print(f"Error: Transcription failed")
        print(result)
        sys.exit(1)

    print("\n" + "=" * 60)
    print("TRANSCRIPTION")
    print("=" * 60)
    print(result.get("transcription", ""))

    # Speaker info
    if result.get("age") or result.get("gender") or result.get("emotions"):
        print("\n" + "-" * 60)
        print("SPEAKER INFO")
        print("-" * 60)
        if result.get("gender"):
            print(f"Gender: {result['gender']}")
        if result.get("age"):
            print(f"Age: {result['age']}")
        if result.get("emotions"):
            print("Emotions:")
            emotions = result["emotions"]
            sorted_emotions = sorted(emotions.items(), key=lambda x: x[1], reverse=True)
            for emotion, score in sorted_emotions:
                print(f"  {emotion}: {score:.4f}")

    # Utterances (speaker diarization)
    if result.get("utterances"):
        print("\n" + "-" * 60)
        print("UTTERANCES")
        print("-" * 60)
        for utt in result["utterances"]:
            speaker = utt.get("speaker", "")
            start = utt.get("start", 0)
            end = utt.get("end", 0)
            text = utt.get("text", "")
            if speaker:
                print(f"[{start:.2f}s - {end:.2f}s] {speaker}: {text}")
            else:
                print(f"[{start:.2f}s - {end:.2f}s] {text}")

    # Word timestamps
    if result.get("words"):
        print("\n" + "-" * 60)
        print("WORD TIMESTAMPS")
        print("-" * 60)
        for word in result["words"]:
            start = word.get("start", 0)
            end = word.get("end", 0)
            text = word.get("word", "")
            speaker = word.get("speaker", "")
            if speaker:
                print(f"[{start:.2f}s - {end:.2f}s] {speaker}: {text}")
            else:
                print(f"[{start:.2f}s - {end:.2f}s] {text}")

    print("\n" + "=" * 60)

    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    text_path = output_dir / f"{audio_path.stem}_transcript.txt"
    with open(text_path, "w", encoding="utf-8") as f:
        f.write(result.get("transcription", ""))
    print(f"Saved: {text_path}")

    json_path = output_dir / f"{audio_path.stem}_result.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Saved: {json_path}")

    print("\nDone!")


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

    print(f"Reading: {audio_path.name}")
    print(f"Transcribing with language: {LANGUAGE}")

    result = transcribe(audio_file, api_key)
    process_response(result, audio_path)


if __name__ == "__main__":
    main()
