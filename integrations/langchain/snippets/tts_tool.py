#!/usr/bin/env python3
"""
Smallest AI Lightning TTS — LangChain Tool (snippet).

Wrap Lightning TTS as a LangChain BaseTool so any agent can generate speech.

Usage:
    from tts_tool import LightningTTSTool
    tts = LightningTTSTool(api_key="your_key")
    audio_path = tts.run("Hello, how can I help you?")
"""

import io
import os
import wave
from pathlib import Path
from typing import Optional, Type

import requests
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

LIGHTNING_API_URL = "https://api.smallest.ai/waves/v1/tts"


class TTSInput(BaseModel):
    text: str = Field(description="Text to convert to speech")
    voice_id: str = Field(default="magnus", description="Voice ID to use for synthesis")


class LightningTTSTool(BaseTool):
    """Convert text to speech using Smallest AI Lightning TTS."""

    name: str = "text_to_speech"
    description: str = (
        "Convert text to speech audio using Smallest AI Lightning TTS. "
        "Input: the text to speak. "
        "Output: path to the generated audio file."
    )
    args_schema: Type[BaseModel] = TTSInput
    api_key: str = ""
    output_dir: str = "output"
    sample_rate: int = 24000

    def __init__(self, api_key: Optional[str] = None, output_dir: str = "output", **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key or os.environ.get("SMALLEST_API_KEY", "")
        self.output_dir = output_dir

    def _run(self, text: str, voice_id: str = "magnus") -> str:
        """Generate speech audio from text. Returns path to output file."""
        if not text.strip():
            return "Error: empty text"

        resp = requests.post(
            LIGHTNING_API_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "voice_id": voice_id,
                "sample_rate": self.sample_rate,
            },
            timeout=30,
        )

        if resp.status_code != 200:
            return f"Error: TTS request failed ({resp.status_code}): {resp.text}"

        # Wrap raw PCM in WAV container
        wav_bytes = self._wrap_wav(resp.content)
        out_dir = Path(self.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "tts_output.wav"
        out_path.write_bytes(wav_bytes)
        return str(out_path)

    def _wrap_wav(self, pcm_data: bytes) -> bytes:
        """Wrap raw PCM bytes in a WAV container."""
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(self.sample_rate)
            wav_file.writeframes(pcm_data)
        return buffer.getvalue()

    async def _arun(self, text: str, voice_id: str = "magnus") -> str:
        """Async version — uses httpx."""
        import httpx

        if not text.strip():
            return "Error: empty text"

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                LIGHTNING_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "voice_id": voice_id,
                    "sample_rate": self.sample_rate,
                },
                timeout=30,
            )

        if resp.status_code != 200:
            return f"Error: TTS request failed ({resp.status_code}): {resp.text}"

        wav_bytes = self._wrap_wav(resp.content)
        out_dir = Path(self.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "tts_output.wav"
        out_path.write_bytes(wav_bytes)
        return str(out_path)
