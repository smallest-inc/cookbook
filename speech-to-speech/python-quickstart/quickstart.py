#!/usr/bin/env python3
"""
Smallest AI Speech-to-Speech (Hydra) - Python Quickstart

Minimal headless Hydra client. Streams a WAV file to the realtime endpoint
as if it were live microphone audio, prints the assistant's transcript as it
arrives, and saves the spoken reply to reply.wav.

Audio is paced at real time (100 ms chunks). Hydra expects a live stream;
dumping the whole file at once gets the session closed by the server.

Usage: python quickstart.py path/to/audio.wav
"""

import array
import asyncio
import base64
import json
import os
import sys
import wave

import websockets
from dotenv import load_dotenv

load_dotenv()

WS_URL = "wss://api.smallest.ai/waves/v1/s2s?model=hydra&api_key={api_key}"

VOICE = "aria"
INSTRUCTIONS = "You are a helpful voice assistant. Keep replies short and conversational."

SAMPLE_RATE = 16000  # Hydra input and output, PCM16 mono
CHUNK_MS = 100
CHUNK_BYTES = SAMPLE_RATE * 2 * CHUNK_MS // 1000  # 3200 bytes per 100 ms
SILENCE_CHUNKS = 12  # ~1.2 s of trailing silence so server VAD closes the turn

OUTPUT_FILE = "reply.wav"


def load_pcm16_mono_16k(path: str) -> bytes:
    """Read a WAV file and return PCM16 mono at 16 kHz (naive resample)."""
    with wave.open(path, "rb") as f:
        channels = f.getnchannels()
        width = f.getsampwidth()
        rate = f.getframerate()
        frames = f.readframes(f.getnframes())

    if width != 2:
        raise SystemExit(f"Error: expected 16-bit PCM WAV, got {width * 8}-bit")

    samples = array.array("h")
    samples.frombytes(frames)

    if channels > 1:
        samples = samples[0::channels]  # keep the first channel

    if rate != SAMPLE_RATE:
        # Naive nearest-sample resample. Fine for a demo; use a proper
        # resampler (e.g. soxr, librosa) for production audio.
        n_out = int(len(samples) * SAMPLE_RATE / rate)
        samples = array.array(
            "h", (samples[int(i * rate / SAMPLE_RATE)] for i in range(n_out))
        )

    return samples.tobytes()


async def send_audio(ws, pcm: bytes) -> None:
    """Stream PCM in 100 ms chunks at real time, then trailing silence."""
    for i in range(0, len(pcm), CHUNK_BYTES):
        await ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": base64.b64encode(pcm[i:i + CHUNK_BYTES]).decode(),
        }))
        await asyncio.sleep(CHUNK_MS / 1000)

    silence = base64.b64encode(b"\x00" * CHUNK_BYTES).decode()
    for _ in range(SILENCE_CHUNKS):
        await ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": silence,
        }))
        await asyncio.sleep(CHUNK_MS / 1000)


async def run(audio_path: str, api_key: str) -> bytes:
    reply_chunks = []

    async with websockets.connect(WS_URL.format(api_key=api_key)) as ws:
        await ws.send(json.dumps({
            "type": "session.configure",
            "session": {
                "instructions": INSTRUCTIONS,
                "voice": VOICE,
                "input_audio_sample_rate": SAMPLE_RATE,
                "output_audio_sample_rate": SAMPLE_RATE,
            },
        }))

        pcm = load_pcm16_mono_16k(audio_path)
        print(f"Streaming {len(pcm) / (SAMPLE_RATE * 2):.1f}s of audio...")
        sender = asyncio.create_task(send_audio(ws, pcm))

        try:
            async for message in ws:
                event = json.loads(message)
                event_type = event.get("type")

                if event_type == "input_audio_buffer.speech_started":
                    print("[speech started]")

                elif event_type == "input_audio_buffer.speech_stopped":
                    print("[speech stopped]")

                elif event_type == "response.output_audio.delta":
                    audio_b64 = event.get("delta") or event.get("audio") or ""
                    reply_chunks.append(base64.b64decode(audio_b64))

                elif event_type == "response.output_audio_transcript.delta":
                    print(event.get("delta", ""), end="", flush=True)

                elif event_type == "response.done":
                    print()
                    break

                elif event_type == "error":
                    print(f"\nError: {event}", file=sys.stderr)
                    sys.exit(1)
        finally:
            sender.cancel()

    return b"".join(reply_chunks)


def save_wav(pcm_data: bytes, path: str) -> None:
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)  # 16-bit
        f.setframerate(SAMPLE_RATE)
        f.writeframes(pcm_data)


def main():
    if len(sys.argv) < 2:
        print("Usage: python quickstart.py path/to/audio.wav")
        sys.exit(1)

    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    reply_pcm = asyncio.run(run(sys.argv[1], api_key))

    if reply_pcm:
        save_wav(reply_pcm, OUTPUT_FILE)
        print(f"Saved reply to {OUTPUT_FILE}")
    else:
        print("No reply audio received")


if __name__ == "__main__":
    main()
