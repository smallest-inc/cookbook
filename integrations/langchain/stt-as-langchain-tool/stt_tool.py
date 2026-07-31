#!/usr/bin/env python3
"""
Pulse STT — LangChain Tool.

Wraps Smallest AI's Pulse speech-to-text API as a LangChain BaseTool.
Supports file transcription (REST) and streaming (WebSocket).

Usage:
    from stt_tool import PulseSTTTool

    # Standalone
    stt = PulseSTTTool(api_key="your_key")
    transcript = stt.run("recording.wav")

    # Inside a LangChain agent
    from langchain.agents import AgentExecutor, create_tool_calling_agent
    tools = [PulseSTTTool()]
    agent = create_tool_calling_agent(llm, tools, prompt)
"""

import os
import json
import asyncio
from pathlib import Path
from typing import Optional, Type
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

load_dotenv()

PULSE_REST_URL = "https://api.smallest.ai/waves/v1/stt/"
PULSE_WS_URL = "wss://api.smallest.ai/waves/v1/stt/live"  # connect with ?model=pulse plus stream params


class PulseSTTInput(BaseModel):
    audio_path: str = Field(description="Path to the audio file to transcribe")
    language: str = Field(default="en", description="Language code (ISO 639-1) or 'multi' for auto-detect")
    word_timestamps: bool = Field(default=False, description="Include word-level timestamps")
    diarize: bool = Field(default=False, description="Enable speaker diarization")
    emotion_detection: bool = Field(default=False, description="Detect speaker emotions")


class PulseSTTTool(BaseTool):
    """Transcribe audio to text using Smallest AI Pulse STT."""

    name: str = "speech_to_text"
    description: str = (
        "Transcribe an audio file to text using Smallest AI Pulse STT. "
        "Accepts wav, mp3, ogg, flac, webm. "
        "Input: path to audio file. Output: the transcribed text."
    )
    args_schema: Type[BaseModel] = PulseSTTInput
    api_key: str = ""

    def __init__(self, api_key: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key or os.environ.get("SMALLEST_API_KEY", "")

    def _run(
        self,
        audio_path: str,
        language: str = "en",
        word_timestamps: bool = False,
        diarize: bool = False,
        emotion_detection: bool = False,
    ) -> str:
        """Transcribe audio file via Pulse REST API."""
        path = Path(audio_path)
        if not path.exists():
            return f"Error: file not found: {audio_path}"

        with open(path, "rb") as f:
            audio_data = f.read()

        params = {
            "model": "pulse",
            "language": language,
            "word_timestamps": str(word_timestamps).lower(),
            "diarize": str(diarize).lower(),
            "emotion_detection": str(emotion_detection).lower(),
        }

        resp = requests.post(
            PULSE_REST_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/octet-stream",
            },
            params=params,
            data=audio_data,
            timeout=300,
        )

        if resp.status_code != 200:
            return f"Error: Pulse STT failed ({resp.status_code}): {resp.text}"

        data = resp.json()
        if data.get("status") != "success":
            return f"Error: {data}"

        parts = [data.get("transcription", "")]

        if diarize and data.get("utterances"):
            parts.append("\n--- Speaker Diarization ---")
            for utt in data["utterances"]:
                speaker = utt.get("speaker", "?")
                text = utt.get("text", "")
                start = utt.get("start", 0)
                end = utt.get("end", 0)
                parts.append(f"[{start:.1f}s-{end:.1f}s] Speaker {speaker}: {text}")

        if emotion_detection and data.get("emotions"):
            parts.append("\n--- Emotions ---")
            for emotion, score in sorted(data["emotions"].items(), key=lambda x: x[1], reverse=True):
                parts.append(f"  {emotion}: {score:.3f}")

        return "\n".join(parts)

    async def _arun(
        self,
        audio_path: str,
        language: str = "en",
        word_timestamps: bool = False,
        diarize: bool = False,
        emotion_detection: bool = False,
    ) -> str:
        """Async version using httpx."""
        import httpx

        path = Path(audio_path)
        if not path.exists():
            return f"Error: file not found: {audio_path}"

        with open(path, "rb") as f:
            audio_data = f.read()

        params = {
            "model": "pulse",
            "language": language,
            "word_timestamps": str(word_timestamps).lower(),
            "diarize": str(diarize).lower(),
            "emotion_detection": str(emotion_detection).lower(),
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                PULSE_REST_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/octet-stream",
                },
                params=params,
                content=audio_data,
                timeout=300,
            )

        if resp.status_code != 200:
            return f"Error: Pulse STT failed ({resp.status_code}): {resp.text}"

        data = resp.json()
        return data.get("transcription", data.get("text", ""))


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python stt_tool.py <audio_file>")
        sys.exit(1)

    tool = PulseSTTTool()
    result = tool.run(sys.argv[1])
    print(result)
