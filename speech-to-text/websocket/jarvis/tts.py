"""
Lightning TTS HTTP Client

This module uses the HTTP POST endpoint for text-to-speech. The entire audio
is generated server-side and returned in one response, then played back locally.

For lower latency, you can upgrade to the WebSocket streaming API which delivers
audio chunks as they're generated. See:
https://waves-docs.smallest.ai/content/api-references/lightning-v3.1-ws
"""

import asyncio
import os
import queue
import threading

import httpx
import pyaudio

TTS_URL = "https://api.smallest.ai/waves/v1/tts"
TTS_VOICE = "sophia"
TTS_SAMPLE_RATE = 24000
PLAYBACK_CHUNK_SIZE = 4800


class TTSClient:
    """
    TTS HTTP client with background audio playback.
    
    This implementation waits for the complete audio before playback starts.
    For streaming playback, you would use WebSocket and start playing chunks
    as they arrive from the server.
    """

    def __init__(self, voice: str = TTS_VOICE, sample_rate: int = TTS_SAMPLE_RATE):
        api_key = os.environ.get("SMALLEST_API_KEY")
        if not api_key:
            raise ValueError("SMALLEST_API_KEY environment variable not set")
        self.api_key = api_key
        self.voice = voice
        self.sample_rate = sample_rate
        self.audio_queue = queue.Queue()
        self.playback_thread = None
        self.pyaudio_instance = None
        self.audio_stream = None
        self.stop_playback = False

    def _play_audio(self):
        """Background thread that plays audio from the queue."""
        while not self.stop_playback:
            try:
                data = self.audio_queue.get(timeout=0.1)
                if data is None:
                    break
                self.audio_stream.write(data)
            except queue.Empty:
                continue

    def start(self):
        """Initialize audio playback."""
        self.pyaudio_instance = pyaudio.PyAudio()
        self.audio_stream = self.pyaudio_instance.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            output=True,
        )

        self.stop_playback = False
        self.playback_thread = threading.Thread(target=self._play_audio, daemon=True)
        self.playback_thread.start()

    async def speak(self, text: str):
        """
        Convert text to speech and play it.
        
        With HTTP POST, we wait for the full audio before playback begins.
        With WebSocket streaming, you could start playback as soon as the
        first audio chunk arrives, reducing perceived latency.
        """
        if not text.strip():
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "lightning_v3.1",
            "text": text,
            "voice_id": self.voice,
            "sample_rate": self.sample_rate,
            "speed": 1.0,
            "language": "en",
            "output_format": "pcm",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(TTS_URL, headers=headers, json=payload)

            if response.status_code != 200:
                print(f"[TTS ERROR] {response.status_code}: {response.text}")
                return

            audio_bytes = response.content

            # Feed audio to playback thread in chunks to avoid buffer issues
            for i in range(0, len(audio_bytes), PLAYBACK_CHUNK_SIZE):
                self.audio_queue.put(audio_bytes[i:i + PLAYBACK_CHUNK_SIZE])

        while not self.audio_queue.empty():
            await asyncio.sleep(0.1)
        await asyncio.sleep(0.2)

    def stop(self):
        """Stop playback and clean up resources."""
        self.stop_playback = True
        self.audio_queue.put(None)

        if self.playback_thread:
            self.playback_thread.join(timeout=2.0)
        if self.audio_stream:
            self.audio_stream.stop_stream()
            self.audio_stream.close()
        if self.pyaudio_instance:
            self.pyaudio_instance.terminate()
