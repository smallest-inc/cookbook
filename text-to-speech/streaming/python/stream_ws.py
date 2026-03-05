#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - WebSocket Streaming

Stream audio in real-time via WebSocket. Supports bidirectional communication
for real-time conversations and LLM pipelines.

Usage: python stream_ws.py "Text to stream"

Output:
- WAV audio file (streamed_ws_output.wav)
- Latency metrics printed to console
"""

import asyncio
import base64
import json
import os
import struct
import sys
import time
import websockets
from dotenv import load_dotenv

load_dotenv()

MODEL = "lightning-v3.1"
VOICE_ID = "sophia"
SAMPLE_RATE = 24000
SPEED = 1.0

WS_URL = f"wss://api.smallest.ai/waves/v1/{MODEL}/get_speech/stream"


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
        1,
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header + pcm_data


async def stream_speech(text: str, api_key: str) -> bytes:
    start_time = time.time()
    first_chunk_time = None
    chunks = []
    chunk_count = 0

    headers = {"Authorization": f"Bearer {api_key}"}

    async with websockets.connect(WS_URL, additional_headers=headers) as ws:
        await ws.send(json.dumps({
            "text": text,
            "voice_id": VOICE_ID,
            "sample_rate": SAMPLE_RATE,
            "speed": SPEED,
        }))

        async for message in ws:
            data = json.loads(message)

            if data.get("status") == "error":
                error = data.get("error", {})
                raise Exception(f"WebSocket error: {error.get('message', data)}")

            if data.get("status") == "complete":
                break

            if data.get("status") == "chunk":
                audio_b64 = data["data"]["audio"]
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
        print('Usage: python stream_ws.py "Text to stream"')
        sys.exit(1)

    text = sys.argv[1]
    api_key = os.environ.get("SMALLEST_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    print(f"Streaming with WebSocket ({MODEL}, {VOICE_ID})...")
    wav_data = asyncio.run(stream_speech(text, api_key))

    output_file = "streamed_ws_output.wav"
    with open(output_file, "wb") as f:
        f.write(wav_data)

    print(f"  Saved to {output_file}")


if __name__ == "__main__":
    main()
