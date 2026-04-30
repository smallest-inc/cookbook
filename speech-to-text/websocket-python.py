"""
Speech-to-Text WebSocket — Python
Real-time transcription over WebSocket using a sample audio file.

Usage:
    export SMALLEST_API_KEY="your-api-key"
    pip install websockets requests
    python websocket-python.py

Docs: https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/realtime-web-socket/quickstart
"""

import asyncio
import websockets
import json
import os
import requests
from urllib.parse import urlencode

API_KEY = os.environ["SMALLEST_API_KEY"]
SAMPLE_URL = "https://github.com/smallest-inc/cookbook/raw/main/speech-to-text/getting-started/samples/audio.wav"
CHUNK_SIZE = 4096

params = {
    "language": "en",
    "encoding": "linear16",
    "sample_rate": "16000",
    "word_timestamps": "true",
}
WS_URL = f"wss://api.smallest.ai/waves/v1/pulse/get_text?{urlencode(params)}"


async def transcribe():
    # Download sample audio
    audio_data = requests.get(SAMPLE_URL).content
    # Skip WAV header (44 bytes) to get raw PCM
    pcm_data = audio_data[44:]

    headers = {"Authorization": f"Bearer {API_KEY}"}

    async with websockets.connect(WS_URL, additional_headers=headers) as ws:
        print("Connected to Pulse STT WebSocket")

        # Send audio in chunks
        for i in range(0, len(pcm_data), CHUNK_SIZE):
            await ws.send(pcm_data[i : i + CHUNK_SIZE])

        # Signal end of audio (close_stream triggers is_last=true)
        await ws.send(json.dumps({"type": "close_stream"}))

        # Receive transcription results, concatenating finals into a session transcript
        full_transcript = ""
        async for message in ws:
            data = json.loads(message)
            if data.get("is_final"):
                print(f"Final: {data.get('transcript')}")
                full_transcript += data.get("transcript", "") or ""
                if data.get("is_last"):
                    print(f"\nFull Transcript: {full_transcript}")
                    break
            else:
                print(f"Partial: {data.get('transcript')}")


asyncio.run(transcribe())
