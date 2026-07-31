#!/usr/bin/env python3
"""
Real-time Speech-to-Text with Pulse STT WebSocket API

Streams audio files or microphone input and displays live transcription.

Usage:
    python streaming_client.py --file recording.wav
    python streaming_client.py --file recording.wav --language hi
    python streaming_client.py  # (microphone, requires pyaudio)

Requirements:
    pip install websockets
    
    For microphone support:
        macOS: brew install portaudio && pip install pyaudio
        Ubuntu: sudo apt-get install portaudio19-dev && pip install pyaudio
"""

import os
import sys
import asyncio
import argparse
import json
import wave
from typing import Callable, Optional

try:
    import websockets
except ImportError:
    print("Install websockets: pip install websockets")
    sys.exit(1)

try:
    import pyaudio
except ImportError:
    pyaudio = None


class PulseStreamingClient:
    """
    Real-time speech-to-text client using Smallest AI Pulse WebSocket API.
    """

    def __init__(
        self,
        api_key: str,
        language: str = "en",
        sample_rate: int = 16000,
        on_transcript: Optional[Callable[[str, bool], None]] = None
    ):
        self.api_key = api_key
        self.language = language
        self.sample_rate = sample_rate
        self.on_transcript = on_transcript or self._default_handler
        self.ws = None
        self.is_running = False

    def _default_handler(self, text: str, is_final: bool):
        if is_final:
            print(f"\n✅ {text}")
        else:
            print(f"\r⏳ {text}...", end="", flush=True)

    def _build_url(self) -> str:
        params = {
            "model": "pulse",
            "language": self.language,
            "encoding": "linear16",
            "sample_rate": str(self.sample_rate),
            "word_timestamps": "true",
            "full_transcript": "true"
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"wss://api.smallest.ai/waves/v1/stt/live?{query}"

    async def _receive_transcripts(self):
        """Handle incoming transcription messages."""
        try:
            async for message in self.ws:
                try:
                    response = json.loads(message)

                    if response.get("status") == "error":
                        msg = response.get("message", "Unknown error")
                        if "timed out" in str(msg).lower():
                            continue
                        print(f"\n❌ API Error: {msg}")
                        continue

                    if response.get("transcript"):
                        is_final = response.get("is_final", False)
                        self.on_transcript(response["transcript"], is_final)

                except json.JSONDecodeError as e:
                    print(f"\n❌ Parse error: {e}")

        except websockets.exceptions.ConnectionClosed:
            print("\n🔌 Connection closed")

    async def _stream_microphone(self):
        """Capture and stream microphone audio."""
        if pyaudio is None:
            print("❌ PyAudio not installed. Use --file option instead.")
            self.is_running = False
            return

        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=1024
        )

        print("🎤 Listening... (Ctrl+C to stop)\n")

        try:
            while self.is_running:
                audio_data = stream.read(1024, exception_on_overflow=False)

                if self.ws:
                    try:
                        await self.ws.send(audio_data)
                    except websockets.exceptions.ConnectionClosed:
                        break

                await asyncio.sleep(0.01)

        finally:
            stream.stop_stream()
            stream.close()
            p.terminate()

    async def _stream_file(self, file_path: str):
        """Stream a WAV file to the API."""
        print(f"📁 Streaming file: {file_path}\n")

        with wave.open(file_path, 'rb') as wf:
            # Read audio data (skip header)
            frames = wf.readframes(wf.getnframes())

        chunk_size = 3200  # ~100ms at 16kHz
        for i in range(0, len(frames), chunk_size):
            if not self.is_running:
                break

            chunk = frames[i:i + chunk_size]
            if self.ws:
                try:
                    await self.ws.send(chunk)
                except websockets.exceptions.ConnectionClosed:
                    break

            await asyncio.sleep(0.05)  # Pace the sending

        # Signal end of audio
        if self.ws:
            try:
                await self.ws.send(json.dumps({"type": "close_stream"}))
            except websockets.exceptions.ConnectionClosed:
                pass

        # Wait for final transcripts
        await asyncio.sleep(2)

    async def start(self, file_path: Optional[str] = None):
        """Start the streaming transcription session."""
        self.is_running = True
        headers = {"Authorization": f"Bearer {self.api_key}"}

        print("=" * 60)
        print("🎙️  Pulse STT Real-time Streaming")
        print("=" * 60)
        print(f"🌐 Language: {self.language}")
        print(f"🔊 Sample rate: {self.sample_rate} Hz")
        print()

        try:
            async with websockets.connect(
                self._build_url(),
                additional_headers=headers,
                open_timeout=30
            ) as ws:
                self.ws = ws
                print("✅ Connected to Pulse STT\n")

                if file_path:
                    # Stream file
                    await asyncio.gather(
                        self._receive_transcripts(),
                        self._stream_file(file_path)
                    )
                else:
                    # Stream microphone
                    await asyncio.gather(
                        self._receive_transcripts(),
                        self._stream_microphone()
                    )

        except websockets.exceptions.InvalidHandshake as e:
            error_msg = str(e)
            if "403" in error_msg:
                print("❌ HTTP 403 - WebSocket STT requires Enterprise subscription")
            else:
                print(f"❌ Connection failed: {error_msg}")
        except Exception as e:
            print(f"❌ Error: {e}")

    def stop(self):
        """Stop the streaming session."""
        self.is_running = False


async def main():
    parser = argparse.ArgumentParser(description="Real-time speech-to-text")
    parser.add_argument("--language", "-l", default="en",
                        help="Language code (en, hi, es, multi)")
    parser.add_argument("--file", "-f", help="Stream a WAV file instead of microphone")

    args = parser.parse_args()

    api_key = os.getenv("SMALLEST_API_KEY")
    if not api_key:
        print("❌ SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    transcripts = []

    def handle_transcript(text: str, is_final: bool):
        if is_final:
            transcripts.append(text)
            print(f"\n✅ {text}")
        else:
            print(f"\r⏳ {text}...", end="", flush=True)

    client = PulseStreamingClient(
        api_key=api_key,
        language=args.language,
        on_transcript=handle_transcript
    )

    try:
        await client.start(file_path=args.file)
    except KeyboardInterrupt:
        client.stop()

    print()
    print("=" * 60)
    print("📝 FULL TRANSCRIPT")
    print("=" * 60)
    print(" ".join(transcripts) if transcripts else "(no speech detected)")


if __name__ == "__main__":
    asyncio.run(main())
