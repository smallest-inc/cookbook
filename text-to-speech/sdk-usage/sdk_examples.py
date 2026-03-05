#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - SDK Usage

Demonstrates the official Python SDK for text-to-speech: sync, async, and
streaming synthesis patterns.

Usage:
  python sdk_examples.py               # Run all examples
  python sdk_examples.py --sync        # Sync only
  python sdk_examples.py --async       # Async only
  python sdk_examples.py --streaming   # Streaming only
  python sdk_examples.py --voices      # List voices

Output:
- WAV audio files for each pattern
"""

import argparse
import asyncio
import json
import os
import struct
import sys
from dotenv import load_dotenv

load_dotenv()

MODEL = "lightning-v2"
VOICE_ID = "ashley"
SAMPLE_RATE = 24000


def add_wav_header(pcm_data: bytes, sample_rate: int, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE", b"fmt ", 16, 1,
        channels, sample_rate, byte_rate, block_align, bits_per_sample,
        b"data", data_size,
    )
    return header + pcm_data


def run_sync(api_key: str):
    """Synchronous synthesis — simplest pattern."""
    from smallestai.waves import WavesClient

    print("=" * 50)
    print("SYNC SYNTHESIS")
    print("=" * 50)

    client = WavesClient(api_key=api_key)
    audio = client.synthesize(
        "This audio was generated using the sync Python SDK. It blocks until the full audio is ready.",
        model=MODEL,
        voice_id=VOICE_ID,
        sample_rate=SAMPLE_RATE,
        output_format="wav",
    )

    with open("output_sync.wav", "wb") as f:
        f.write(audio)

    print(f"Saved to output_sync.wav ({len(audio):,} bytes)\n")


async def run_async(api_key: str):
    """Async synthesis — for web servers and async pipelines."""
    from smallestai.waves import AsyncWavesClient

    print("=" * 50)
    print("ASYNC SYNTHESIS")
    print("=" * 50)

    async with AsyncWavesClient(api_key=api_key) as client:
        audio = await client.synthesize(
            "This audio was generated using the async Python SDK. Great for web servers!",
            model=MODEL,
            voice_id=VOICE_ID,
            sample_rate=SAMPLE_RATE,
            output_format="wav",
        )

    with open("output_async.wav", "wb") as f:
        f.write(audio)

    print(f"Saved to output_async.wav ({len(audio):,} bytes)\n")


def run_streaming(api_key: str):
    """Streaming synthesis via WebSocket — for real-time playback."""
    from smallestai.waves import TTSConfig, WavesStreamingTTS

    print("=" * 50)
    print("STREAMING SYNTHESIS")
    print("=" * 50)

    config = TTSConfig(
        voice_id=VOICE_ID,
        api_key=api_key,
        sample_rate=SAMPLE_RATE,
        speed=1.0,
    )

    streaming_tts = WavesStreamingTTS(config)
    chunks = []

    for chunk in streaming_tts.synthesize(
        "This audio was streamed in real-time via WebSocket using the Python SDK."
    ):
        chunks.append(chunk)

    pcm_data = b"".join(chunks)
    wav_data = add_wav_header(pcm_data, SAMPLE_RATE)

    with open("output_streaming.wav", "wb") as f:
        f.write(wav_data)

    print(f"Received {len(chunks)} chunk(s), {len(pcm_data):,} PCM bytes")
    print(f"Saved to output_streaming.wav ({len(wav_data):,} bytes)\n")


def run_voices(api_key: str):
    """List available voices using the SDK."""
    from smallestai.waves import WavesClient

    print("=" * 50)
    print("AVAILABLE VOICES")
    print("=" * 50)

    client = WavesClient(api_key=api_key)
    voices_raw = client.get_voices(model=MODEL)
    voices = json.loads(voices_raw)["voices"]

    print(f"{'Voice ID':<16} {'Name':<16} {'Gender':<8} {'Languages':<20} {'Accent'}")
    print("-" * 75)

    for v in voices:
        tags = v.get("tags", {})
        print(
            f"{v['voiceId']:<16} "
            f"{v['displayName']:<16} "
            f"{tags.get('gender', '—'):<8} "
            f"{', '.join(tags.get('language', [])):<20} "
            f"{tags.get('accent', '—')}"
        )

    print(f"\nTotal: {len(voices)} voice(s)\n")


def main():
    parser = argparse.ArgumentParser(description="Smallest AI TTS SDK examples")
    parser.add_argument("--sync", action="store_true", help="Run sync example")
    parser.add_argument("--async", dest="run_async", action="store_true", help="Run async example")
    parser.add_argument("--streaming", action="store_true", help="Run streaming example")
    parser.add_argument("--voices", action="store_true", help="List voices")
    args = parser.parse_args()

    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    run_all = not (args.sync or args.run_async or args.streaming or args.voices)

    if args.sync or run_all:
        run_sync(api_key)

    if args.run_async or run_all:
        asyncio.run(run_async(api_key))

    if args.streaming or run_all:
        run_streaming(api_key)

    if args.voices or run_all:
        run_voices(api_key)


if __name__ == "__main__":
    main()
