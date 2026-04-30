"""
Speech-to-Text Microphone Input — Python
Real-time transcription from your microphone.

Usage:
    export SMALLEST_API_KEY="your-api-key"
    pip install websockets pyaudio
    python mic-input-python.py

Note: On macOS, install portaudio first: brew install portaudio

Docs: https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/realtime-web-socket/quickstart
"""

import asyncio
import websockets
import json
import os
import pyaudio
from urllib.parse import urlencode

API_KEY = os.environ["SMALLEST_API_KEY"]
SAMPLE_RATE = 16000
CHUNK_SIZE = 4096

params = {
    "language": "en",
    "encoding": "linear16",
    "sample_rate": str(SAMPLE_RATE),
}
WS_URL = f"wss://api.smallest.ai/waves/v1/pulse/get_text?{urlencode(params)}"


async def transcribe_mic():
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE,
    )

    headers = {"Authorization": f"Bearer {API_KEY}"}

    async with websockets.connect(WS_URL, additional_headers=headers) as ws:
        print("Listening... (Ctrl+C to stop)")

        async def send_audio():
            try:
                while True:
                    data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                    await ws.send(data)
                    await asyncio.sleep(0.01)
            except asyncio.CancelledError:
                # close_stream ends the session and triggers is_last=true.
                # finalize would only flush the current buffer without ending.
                try:
                    await ws.send(json.dumps({"type": "close_stream"}))
                except websockets.exceptions.ConnectionClosed:
                    pass

        full_transcript = ""

        async def receive_transcripts():
            nonlocal full_transcript
            async for message in ws:
                result = json.loads(message)
                prefix = ">> " if result.get("is_final") else ".. "
                print(
                    f"{prefix}{result.get('transcript', '')}",
                    end="\r" if not result.get("is_final") else "\n",
                )
                if result.get("is_final"):
                    full_transcript += result.get("transcript", "") or ""
                if result.get("is_last"):
                    return

        send_task = asyncio.create_task(send_audio())
        try:
            await receive_transcripts()
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            send_task.cancel()
            stream.stop_stream()
            stream.close()
            audio.terminate()
            print(f"\nFull Transcript: {full_transcript}")


asyncio.run(transcribe_mic())
