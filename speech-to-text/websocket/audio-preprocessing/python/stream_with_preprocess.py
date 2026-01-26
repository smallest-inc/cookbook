#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Stream with Preprocessing

Preprocesses audio and streams through Pulse STT WebSocket API.

Usage: python stream_with_preprocess.py <audio_file>

Requirements:
- FFmpeg installed
- websockets: pip install websockets

Output:
- Console shows realtime transcription
- {filename}_transcript.txt
"""

import asyncio
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlencode

import websockets

from preprocess import (
    preprocess_for_streaming,
    calculate_streaming_params,
    check_ffmpeg,
    get_audio_info,
    CHUNK_SIZE,
    CHUNK_INTERVAL_MS,
)


WS_URL = "wss://waves-api.smallest.ai/api/v1/pulse/get_text"
LANGUAGE = "en"


async def stream_audio(audio_path: str, api_key: str) -> str:
    """Stream preprocessed audio through WebSocket."""
    params = {
        "model": "pulse",
        "language": LANGUAGE,
        "full_transcript": "true",
    }

    url = f"{WS_URL}?{urlencode(params)}"
    headers = {"Authorization": f"Bearer {api_key}"}

    final_transcript = ""

    async with websockets.connect(url, additional_headers=headers) as ws:

        async def receive():
            nonlocal final_transcript
            async for message in ws:
                data = json.loads(message)

                if data.get("type") == "end":
                    break

                transcript = data.get("transcript", "")
                is_final = data.get("is_final", False)
                is_last = data.get("is_last", False)

                if is_final:
                    print(f"\r{transcript}", end="", flush=True)
                    final_transcript = transcript

                if is_last:
                    print()
                    break

        receiver = asyncio.create_task(receive())

        chunk_interval = CHUNK_INTERVAL_MS / 1000

        with open(audio_path, "rb") as f:
            f.read(44)  # Skip WAV header
            while True:
                chunk = f.read(CHUNK_SIZE)
                if not chunk:
                    break
                await ws.send(chunk)
                await asyncio.sleep(chunk_interval)

        await ws.send(json.dumps({"type": "end"}))
        await receiver

    return final_transcript


def main():
    if len(sys.argv) < 2:
        print("Usage: python stream_with_preprocess.py <audio_file>")
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
    print(f"  Original: {info['sample_rate']} Hz, {info['channels']} ch, {info['duration']:.1f}s")

    print(f"\nPreprocessing for streaming...")
    processed_path = None
    audio_path = str(input_file)

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            processed_path = tmp.name

        preprocess_for_streaming(str(input_file), processed_path)
        audio_path = processed_path

        params = calculate_streaming_params(processed_path)
        print(f"  Ready: {params['total_chunks']} chunks @ {CHUNK_INTERVAL_MS}ms intervals")

    except Exception as e:
        print(f"  Preprocessing failed: {e}")
        print(f"  Falling back to original file...")
        audio_path = str(input_file)

    finally:
        if processed_path and os.path.exists(processed_path) and audio_path != processed_path:
            os.remove(processed_path)

    print(f"\nStreaming...\n")

    start_time = time.time()
    transcript = asyncio.run(stream_audio(audio_path, api_key))
    elapsed = time.time() - start_time

    if processed_path and os.path.exists(processed_path):
        os.remove(processed_path)

    print(f"\nCompleted in {elapsed:.1f}s (audio: {info['duration']:.1f}s)")

    output_file = input_file.parent / f"{input_file.stem}_transcript.txt"
    with open(output_file, "w") as f:
        f.write(transcript)
    print(f"Saved: {output_file}")


if __name__ == "__main__":
    main()
