#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Subtitle Generation

Generate SRT and VTT subtitles from audio or video files.
Uses word timestamps to create properly timed subtitle segments.

Usage: python transcribe.py <audio_or_video_file>

Output:
- {filename}.srt - SubRip subtitle file
- {filename}.vtt - WebVTT subtitle file
"""

import os
import sys
from pathlib import Path

import requests

API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"

LANGUAGE = "en"  # Use ISO 639-1 codes or "multi" for auto-detect
WORDS_PER_SEGMENT = 10  # Maximum words per subtitle segment
MAX_SEGMENT_DURATION = 5.0  # Maximum duration per segment in seconds


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
            "word_timestamps": "true",
        },
        data=audio_data,
        timeout=300,
    )

    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")

    return response.json()


def format_time_srt(seconds: float) -> str:
    """Format seconds to SRT timestamp: HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_time_vtt(seconds: float) -> str:
    """Format seconds to VTT timestamp: HH:MM:SS.mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def create_segments(words: list) -> list:
    """Group words into subtitle segments."""
    segments = []
    current_segment = []
    segment_start = None

    for word in words:
        if segment_start is None:
            segment_start = word.get("start", 0)

        current_segment.append(word)
        segment_end = word.get("end", 0)
        segment_duration = segment_end - segment_start

        if len(current_segment) >= WORDS_PER_SEGMENT or segment_duration >= MAX_SEGMENT_DURATION:
            segments.append({
                "start": segment_start,
                "end": segment_end,
                "text": " ".join(w.get("word", "") for w in current_segment)
            })
            current_segment = []
            segment_start = None

    if current_segment:
        segments.append({
            "start": segment_start,
            "end": current_segment[-1].get("end", 0),
            "text": " ".join(w.get("word", "") for w in current_segment)
        })

    return segments


def generate_srt(segments: list) -> str:
    """Generate SRT format subtitles."""
    lines = []
    for i, segment in enumerate(segments, 1):
        start = format_time_srt(segment["start"])
        end = format_time_srt(segment["end"])
        lines.append(f"{i}")
        lines.append(f"{start} --> {end}")
        lines.append(segment["text"])
        lines.append("")
    return "\n".join(lines)


def generate_vtt(segments: list) -> str:
    """Generate WebVTT format subtitles."""
    lines = ["WEBVTT", ""]
    for i, segment in enumerate(segments, 1):
        start = format_time_vtt(segment["start"])
        end = format_time_vtt(segment["end"])
        lines.append(f"{i}")
        lines.append(f"{start} --> {end}")
        lines.append(segment["text"])
        lines.append("")
    return "\n".join(lines)


def process_response(result: dict, audio_path: Path):
    if result.get("status") != "success":
        print("Error: Transcription failed")
        print(result)
        sys.exit(1)

    words = result.get("words", [])
    if not words:
        print("Error: No word timestamps returned. Cannot generate subtitles.")
        sys.exit(1)

    print(f"Transcription: {result.get('transcription', '')[:100]}...")
    print(f"Words detected: {len(words)}")

    segments = create_segments(words)
    print(f"Subtitle segments: {len(segments)}")

    # Generate SRT
    srt_content = generate_srt(segments)
    srt_path = audio_path.with_suffix(".srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    print(f"Saved: {srt_path}")

    # Generate VTT
    vtt_content = generate_vtt(segments)
    vtt_path = audio_path.with_suffix(".vtt")
    with open(vtt_path, "w", encoding="utf-8") as f:
        f.write(vtt_content)
    print(f"Saved: {vtt_path}")

    print("\nDone!")


def main():
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_or_video_file>")
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

    print(f"Processing: {audio_path.name}")

    result = transcribe(audio_file, api_key)
    process_response(result, audio_path)


if __name__ == "__main__":
    main()

