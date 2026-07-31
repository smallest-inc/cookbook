#!/usr/bin/env python3
"""
Lightning TTS — LangChain Tool.

Wraps Smallest AI's Lightning text-to-speech API as a LangChain BaseTool.
Generates speech audio from text; returns path to the saved audio file.

Usage:
    from tts_tool import LightningTTSTool

    # Standalone
    tts = LightningTTSTool(api_key="your_key")
    audio_path = tts.run("Hello, how can I help you?")

    # Inside a LangChain agent
    tools = [LightningTTSTool()]
    agent = create_tool_calling_agent(llm, tools, prompt)
"""

import io
import os
import time
import wave
from pathlib import Path
from typing import Optional, Type

import requests
from dotenv import load_dotenv
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

load_dotenv()

LIGHTNING_API_URL = "https://api.smallest.ai/waves/v1/tts"


class LightningTTSInput(BaseModel):
    text: str = Field(description="Text to convert to speech")
    voice_id: str = Field(default="magnus", description="Voice ID for synthesis")


class LightningTTSTool(BaseTool):
    """Convert text to speech using Smallest AI Lightning TTS."""

    name: str = "text_to_speech"
    description: str = (
        "Convert text to speech audio using Smallest AI Lightning TTS. "
        "Input: the text to speak and optionally a voice_id. "
        "Output: path to the generated audio file."
    )
    args_schema: Type[BaseModel] = LightningTTSInput
    api_key: str = ""
    output_dir: str = "output"
    sample_rate: int = 24000

    def __init__(
        self,
        api_key: Optional[str] = None,
        output_dir: str = "output",
        sample_rate: int = 24000,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or os.environ.get("SMALLEST_API_KEY", "")
        self.output_dir = output_dir
        self.sample_rate = sample_rate

    def _synthesize(self, text: str, voice_id: str = "magnus") -> bytes:
        """Call Lightning TTS API and return raw PCM audio bytes."""
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
            raise RuntimeError(f"Lightning TTS failed ({resp.status_code}): {resp.text}")

        return resp.content

    def _wrap_wav(self, pcm_data: bytes) -> bytes:
        """Wrap raw PCM bytes in a WAV container."""
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(self.sample_rate)
            wav_file.writeframes(pcm_data)
        return buffer.getvalue()

    def _run(self, text: str, voice_id: str = "magnus") -> str:
        """Generate speech and save to file. Returns file path."""
        if not text.strip():
            return "Error: empty text"

        pcm_bytes = self._synthesize(text, voice_id)
        wav_bytes = self._wrap_wav(pcm_bytes)

        out_dir = Path(self.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        # Unique filename with timestamp
        filename = f"tts_{int(time.time() * 1000)}.wav"
        out_path = out_dir / filename
        out_path.write_bytes(wav_bytes)

        return str(out_path)

    async def _arun(self, text: str, voice_id: str = "magnus") -> str:
        """Async version using httpx."""
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
            return f"Error: Lightning TTS failed ({resp.status_code}): {resp.text}"

        pcm_bytes = resp.content
        wav_bytes = self._wrap_wav(pcm_bytes)

        out_dir = Path(self.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        filename = f"tts_{int(time.time() * 1000)}.wav"
        out_path = out_dir / filename
        out_path.write_bytes(wav_bytes)

        return str(out_path)

    def synthesize_bytes(self, text: str, voice_id: str = "magnus") -> bytes:
        """Get raw audio bytes without saving to file."""
        return self._synthesize(text, voice_id)


if __name__ == "__main__":
    import sys

    text = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Hello, this is a test."
    tool = LightningTTSTool()
    result = tool.run(text)
    print(f"Audio saved to: {result}")
