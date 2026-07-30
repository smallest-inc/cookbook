"""
Pulse STT WebSocket Client

This module handles real-time speech-to-text using WebSocket streaming.
Audio is captured from the microphone in a background thread and sent
to the Pulse API, which returns transcriptions as they're recognized.

The WebSocket approach is ideal for STT because:
- Low latency: Results arrive as you speak
- Continuous: No need to detect speech boundaries client-side
- Efficient: Single connection for the entire session
"""

import asyncio
import os
import queue
import threading
from urllib.parse import urlencode

import pyaudio
import websockets

STT_WS_URL = "wss://api.smallest.ai/waves/v1/stt/live"
STT_SAMPLE_RATE = 16000
STT_LANGUAGE = "en"

# Customize according to your needs
CHUNK_SIZE = 1600
CHANNELS = 1
FORMAT = pyaudio.paInt16


class STTClient:
    """
    STT WebSocket client with microphone capture.
    
    Uses a separate thread for audio capture to avoid blocking the async event loop.
    Audio chunks are queued and sent to the WebSocket as fast as the network allows.
    """

    def __init__(self, language: str = STT_LANGUAGE, sample_rate: int = STT_SAMPLE_RATE):
        api_key = os.environ.get("SMALLEST_API_KEY")
        if not api_key:
            raise ValueError("SMALLEST_API_KEY environment variable not set")
        self.api_key = api_key
        self.language = language
        self.sample_rate = sample_rate
        self.audio_queue = queue.Queue()
        self.running = False
        self.paused = False
        self.capture_thread = None
        self.ws = None

    def _capture_audio(self):
        """Capture microphone audio in a background thread."""
        p = pyaudio.PyAudio()
        stream = p.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=CHUNK_SIZE,
        )

        while self.running:
            try:
                self.audio_queue.put(stream.read(CHUNK_SIZE, exception_on_overflow=False))
            except Exception as e:
                print(f"[Audio Error] {e}")
                break

        stream.stop_stream()
        stream.close()
        p.terminate()

    async def connect(self):
        """Connect to STT WebSocket and start audio capture."""
        params = {
            "model": "pulse",
            "language": self.language,
            "encoding": "linear16",
            "sample_rate": self.sample_rate,
        }
        url = f"{STT_WS_URL}?{urlencode(params)}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        self.ws = await websockets.connect(url, additional_headers=headers, open_timeout=30)
        self.running = True

        self.capture_thread = threading.Thread(target=self._capture_audio, daemon=True)
        self.capture_thread.start()

    async def send_audio(self):
        """Send audio chunks to STT WebSocket. Skips while paused."""
        while self.running:
            if self.paused:
                while not self.audio_queue.empty():
                    self.audio_queue.get_nowait()
                await asyncio.sleep(0.05)
                continue

            while not self.audio_queue.empty():
                await self.ws.send(self.audio_queue.get_nowait())
            await asyncio.sleep(0.05)

    def pause(self):
        """Pause audio capture (clears queue while paused)."""
        self.paused = True

    def resume(self):
        """Resume audio capture."""
        self.paused = False

    def clear_queue(self):
        """Clear any buffered audio."""
        while not self.audio_queue.empty():
            self.audio_queue.get_nowait()

    async def close(self):
        """Close WebSocket connection."""
        self.running = False
        if self.ws:
            await self.ws.close()
