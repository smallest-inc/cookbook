#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - SSE Streaming

Stream audio in real-time via Server-Sent Events (SSE). Audio chunks arrive
as they're generated, enabling low-latency playback.

Usage: python stream_sse.py "Text to stream"

Output:
- WAV audio file (streamed_output.wav)
- Latency metrics printed to console
"""

import base64
import json
import os
import struct
import sys
import time
import requests
from dotenv import load_dotenv

load_dotenv()

MODEL = "lightning-v3.1"
VOICE_ID = "sophia"
SAMPLE_RATE = 24000
SPEED = 1.0

API_BASE = "https://api.smallest.ai/waves/v1"


def add_wav_header(pcm_data: bytes, sample_rate: int, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,  # PCM
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header + pcm_data


def stream_speech(text: str, api_key: str) -> bytes:
    start_time = time.time()
    first_chunk_time = None
    chunks = []
    chunk_count = 0

    response = requests.post(
        f"{API_BASE}/{MODEL}/stream",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": VOICE_ID,
            "sample_rate": SAMPLE_RATE,
            "speed": SPEED,
        },
        stream=True,
    )

    if response.status_code != 200:
        raise Exception(f"API request failed ({response.status_code}): {response.text}")

    for line in response.iter_lines():
        if not line:
            continue

        decoded = line.decode("utf-8")

        if not decoded.startswith("data:"):
            continue

        payload = json.loads(decoded[5:].strip())

        if payload.get("done"):
            break

        audio_b64 = payload.get("audio")
        if not audio_b64:
            continue

        audio_bytes = base64.b64decode(audio_b64)
        chunks.append(audio_bytes)
        chunk_count += 1

        if first_chunk_time is None:
            first_chunk_time = time.time()
            ttfb = (first_chunk_time - start_time) * 1000
            print(f"  Time to first byte: {ttfb:.0f}ms")

    total_time = (time.time() - start_time) * 1000
    pcm_data = b"".join(chunks)

    print(f"  Total chunks: {chunk_count}")
    print(f"  Total time: {total_time:.0f}ms")
    print(f"  Audio size: {len(pcm_data):,} bytes")

    return add_wav_header(pcm_data, SAMPLE_RATE)


def main():
    if len(sys.argv) < 2:
        print('Usage: python stream_sse.py "Text to stream"')
        sys.exit(1)

    text = sys.argv[1]
    api_key = os.environ.get("SMALLEST_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    print(f"Streaming with SSE ({MODEL}, {VOICE_ID})...")
    wav_data = stream_speech(text, api_key)

    output_file = "streamed_output.wav"
    with open(output_file, "wb") as f:
        f.write(wav_data)

    print(f"  Saved to {output_file}")


if __name__ == "__main__":
    main()
