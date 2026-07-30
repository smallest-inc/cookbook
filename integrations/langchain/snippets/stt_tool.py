#!/usr/bin/env python3
"""
Smallest AI Pulse STT — LangChain Tool (snippet).

Wrap Pulse STT as a LangChain BaseTool so any agent can transcribe audio files.

Usage:
    from stt_tool import PulseSTTTool
    stt = PulseSTTTool(api_key="your_key")
    transcript = stt.run("recording.wav")
"""

import os
from pathlib import Path
from typing import Optional, Type

import requests
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

PULSE_API_URL = "https://api.smallest.ai/waves/v1/stt/"


class STTInput(BaseModel):
    audio_path: str = Field(description="Path to the audio file to transcribe")
    language: str = Field(default="en", description="Language code (ISO 639-1) or 'multi' for auto-detect")


class PulseSTTTool(BaseTool):
    """Transcribe audio to text using Smallest AI Pulse STT."""

    name: str = "speech_to_text"
    description: str = (
        "Transcribe an audio file to text using Smallest AI Pulse STT. "
        "Input: path to an audio file (wav, mp3, ogg, etc). "
        "Output: the transcribed text."
    )
    args_schema: Type[BaseModel] = STTInput
    api_key: str = ""

    def __init__(self, api_key: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key or os.environ.get("SMALLEST_API_KEY", "")

    def _run(self, audio_path: str, language: str = "en") -> str:
        """Transcribe audio file to text."""
        path = Path(audio_path)
        if not path.exists():
            return f"Error: file not found: {audio_path}"

        with open(path, "rb") as f:
            audio_data = f.read()

        resp = requests.post(
            PULSE_API_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/octet-stream",
            },
            params={"model": "pulse", "language": language},
            data=audio_data,
            timeout=120,
        )

        if resp.status_code != 200:
            return f"Error: STT request failed ({resp.status_code}): {resp.text}"

        data = resp.json()
        return data.get("transcription", data.get("text", ""))

    async def _arun(self, audio_path: str, language: str = "en") -> str:
        """Async version — uses httpx."""
        import httpx

        path = Path(audio_path)
        if not path.exists():
            return f"Error: file not found: {audio_path}"

        with open(path, "rb") as f:
            audio_data = f.read()

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                PULSE_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/octet-stream",
                },
                params={"model": "pulse", "language": language},
                content=audio_data,
                timeout=120,
            )

        if resp.status_code != 200:
            return f"Error: STT request failed ({resp.status_code}): {resp.text}"

        data = resp.json()
        return data.get("transcription", data.get("text", ""))
