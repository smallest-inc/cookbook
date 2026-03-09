#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - Audiobook Generator

Convert a text file into a narrated audiobook with chapter-based splitting.

Usage:
  python generate.py story.txt
  python generate.py story.txt --voice magnus --speed 0.9
  python generate.py --text "Once upon a time..."

Output:
- audiobook_output/audiobook.wav  — full audiobook
- audiobook_output/chapter_*.wav  — individual chapters
"""

import argparse
import os
import struct
import sys
import textwrap
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_BASE = "https://api.smallest.ai/waves/v1"
SAMPLE_RATE = 24000


def split_into_chapters(text: str, chapter_marker: str = "---") -> list:
    """Split text into chapters using a marker, falling back to double newlines."""
    if chapter_marker in text:
        chapters = [c.strip() for c in text.split(chapter_marker) if c.strip()]
    else:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if len(paragraphs) <= 1:
            chapters = [text.strip()]
        else:
            chapters = paragraphs

    return chapters


def chunk_text(text: str, max_chunk: int = 500) -> list:
    """Break a chapter into API-friendly chunks, splitting on sentence boundaries."""
    if len(text) <= max_chunk:
        return [text]

    chunks = []
    current = ""

    for sentence in text.replace(". ", ".\n").split("\n"):
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(current) + len(sentence) + 1 > max_chunk and current:
            chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}" if current else sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks


def synthesize(text: str, voice_id: str, speed: float, model: str, api_key: str) -> bytes:
    response = requests.post(
        f"{API_BASE}/{model}/get_speech",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": voice_id,
            "speed": speed,
            "sample_rate": SAMPLE_RATE,
            "output_format": "wav",
        },
    )

    if response.status_code != 200:
        raise Exception(f"TTS error ({response.status_code}): {response.text}")

    return response.content


def extract_pcm(wav_data: bytes) -> bytes:
    if wav_data[:4] == b"RIFF":
        return wav_data[44:]
    return wav_data


def make_wav(pcm_data: bytes, sample_rate: int) -> bytes:
    data_size = len(pcm_data)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE", b"fmt ", 16, 1,
        1, sample_rate, sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    return header + pcm_data


def main():
    parser = argparse.ArgumentParser(description="Generate an audiobook from text")
    parser.add_argument("input_file", nargs="?", help="Path to text file")
    parser.add_argument("--text", help="Inline text (instead of file)")
    parser.add_argument("--voice", default="sophia", help="Narrator voice (default: sophia)")
    parser.add_argument("--speed", type=float, default=1.0, help="Narration speed 0.5-2.0 (default: 1.0)")
    parser.add_argument("--model", default="lightning-v3.1", help="TTS model")
    parser.add_argument("--chapter-marker", default="---", help="Chapter separator in text (default: ---)")
    parser.add_argument("--max-chunk", type=int, default=500, help="Max chars per API call (default: 500)")
    args = parser.parse_args()

    if not args.input_file and not args.text:
        parser.print_help()
        sys.exit(1)

    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    if args.text:
        full_text = args.text
    else:
        input_path = Path(args.input_file)
        if not input_path.exists():
            print(f"Error: File not found: {args.input_file}")
            sys.exit(1)
        full_text = input_path.read_text(encoding="utf-8")

    chapters = split_into_chapters(full_text, args.chapter_marker)
    print(f"Voice: {args.voice} | Speed: {args.speed} | Model: {args.model}")
    print(f"Found {len(chapters)} chapter(s)\n")

    output_dir = Path("audiobook_output")
    output_dir.mkdir(exist_ok=True)

    all_pcm = []
    chapter_pause = b"\x00\x00" * int(SAMPLE_RATE * 1.0)  # 1s between chapters

    for ch_idx, chapter in enumerate(chapters, 1):
        chunks = chunk_text(chapter, args.max_chunk)
        chapter_pcm_parts = []

        print(f"Chapter {ch_idx}/{len(chapters)} ({len(chunks)} chunk(s), {len(chapter)} chars)")

        for i, chunk in enumerate(chunks, 1):
            preview = chunk[:50].replace("\n", " ")
            print(f"  [{i}/{len(chunks)}] {preview}{'...' if len(chunk) > 50 else ''}", end=" ", flush=True)

            wav_data = synthesize(chunk, args.voice, args.speed, args.model, api_key)
            pcm = extract_pcm(wav_data)
            chapter_pcm_parts.append(pcm)
            print("✓")

        chapter_pcm = b"".join(chapter_pcm_parts)
        chapter_wav = make_wav(chapter_pcm, SAMPLE_RATE)
        chapter_path = output_dir / f"chapter_{ch_idx:02d}.wav"
        chapter_path.write_bytes(chapter_wav)

        all_pcm.append(chapter_pcm)
        duration = len(chapter_pcm) / (SAMPLE_RATE * 2)
        print(f"  → {chapter_path} ({duration:.1f}s)\n")

    # Combine all chapters
    combined_pcm = chapter_pause.join(all_pcm)
    audiobook_wav = make_wav(combined_pcm, SAMPLE_RATE)
    audiobook_path = output_dir / "audiobook.wav"
    audiobook_path.write_bytes(audiobook_wav)

    total_duration = len(combined_pcm) / (SAMPLE_RATE * 2)
    print(f"Audiobook saved to {audiobook_path}")
    print(f"Total duration: {total_duration:.1f}s ({len(audiobook_wav):,} bytes)")


if __name__ == "__main__":
    main()
