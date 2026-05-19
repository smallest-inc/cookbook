"""
TTS Streaming — Python
Stream speech via SSE (Server-Sent Events) for real-time playback.

Targets the Lightning v3.1 Pro pool on the unified /waves/v1/tts/live
endpoint. Drop the `model` field (or set it to "lightning_v3.1") to use the
standard Lightning v3.1 pool instead.

Usage:
    export SMALLEST_API_KEY="your-api-key"
    pip install requests
    python streaming-python.py

Docs: https://docs.smallest.ai/waves/documentation/text-to-speech-lightning/streaming
"""

import base64
import json
import os
import wave

import requests

API_KEY = os.environ["SMALLEST_API_KEY"]

response = requests.post(
    "https://api.smallest.ai/waves/v1/tts/live",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "text": "Modern problems require modern solutions.",
        "voice_id": "meher",
        "model": "lightning_v3.1_pro",
        "sample_rate": 24000,
    },
    stream=True,
)

response.raise_for_status()

# SSE frames look like:
#   event: audio
#   data: {"audio": "<base64-encoded PCM chunk>"}
#
#   data: {"done": true}
# We collect base64 PCM payloads then write them with a WAV header.
chunks: list[bytes] = []
for line in response.iter_lines():
    if not line:
        continue
    decoded = line.decode("utf-8", "replace")
    if not decoded.startswith("data:"):
        continue
    payload = json.loads(decoded[5:].strip())
    if payload.get("done"):
        break
    audio_b64 = payload.get("audio")
    if audio_b64:
        chunks.append(base64.b64decode(audio_b64))

pcm = b"".join(chunks)
with wave.open("streamed.wav", "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(24000)
    wf.writeframes(pcm)

print(f"Saved streamed.wav ({len(pcm):,} PCM bytes from {len(chunks)} chunks)")
