#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - Live Word Timestamps

Stream TTS audio over WebSocket with per-word timing. Word timestamp frames
arrive alongside the audio chunks, so you can render live captions or
karaoke-style highlighting while the speech is still being generated.

Usage: python word_timestamps.py "Text to speak"

Output:
- One caption line per word with start/end times printed as they arrive
- out.wav (24 kHz mono 16-bit)
"""

import asyncio
import base64
import json
import os
import sys
import wave

import websockets
from dotenv import load_dotenv

load_dotenv()

MODEL = "lightning_v3.1"
VOICE_ID = "sophia"
SAMPLE_RATE = 24000
WS_URL = "wss://api.smallest.ai/waves/v1/tts/live"
OUTPUT_FILE = "out.wav"

DEFAULT_TEXT = "Word timestamps let you caption speech while it is still being generated."


def print_word(entry: dict) -> None:
    """Print one caption line for a word timing object {id, word, start, end}."""
    start = float(entry["start"])
    end = float(entry["end"])
    print(f"[{start:6.2f}s - {end:6.2f}s] {entry['word']}")


async def synthesize(text: str, api_key: str) -> bytes:
    headers = {"Authorization": f"Bearer {api_key}"}
    chunks = []
    word_count = 0

    async with websockets.connect(WS_URL, additional_headers=headers) as ws:
        # Single payload, then flush. No pacing needed for TTS input.
        await ws.send(json.dumps({
            "text": text,
            "voice_id": VOICE_ID,
            "model": MODEL,
            "sample_rate": SAMPLE_RATE,
            "word_timestamps": True,
        }))
        await ws.send(json.dumps({"flush": True}))

        async for message in ws:
            frame = json.loads(message)
            status = frame.get("status")

            if status == "error":
                detail = frame.get("data") or frame.get("message") or frame
                print(f"Error: {detail}", file=sys.stderr)
                sys.exit(1)

            if status == "chunk":
                chunks.append(base64.b64decode(frame["data"]["audio"]))

            elif status == "word_timestamp":
                payload = frame.get("data", {})
                entries = payload if isinstance(payload, list) else payload.get("words", [payload])
                for entry in entries:
                    print_word(entry)
                    word_count += 1

            elif status == "complete":
                break

    print(f"\n{word_count} words, {len(chunks)} audio chunks")
    return b"".join(chunks)


def save_wav(pcm_data: bytes, path: str) -> None:
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)  # 16-bit
        f.setframerate(SAMPLE_RATE)
        f.writeframes(pcm_data)


def main():
    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    text = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TEXT

    print(f"Synthesizing with {MODEL} ({VOICE_ID})...\n")
    pcm_data = asyncio.run(synthesize(text, api_key))

    save_wav(pcm_data, OUTPUT_FILE)
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
