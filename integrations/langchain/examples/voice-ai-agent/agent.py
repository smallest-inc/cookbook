#!/usr/bin/env python3
"""
Voice AI Agent — End-to-End: Audio In → STT → LangChain Agent → TTS → Audio Out.

Combines:
- Smallest AI Pulse STT (speech → text)
- LangChain agent with tools + memory (reasoning)
- Smallest AI Lightning TTS (text → speech)

Modes:
    --audio <file>     Transcribe a file, run agent, generate TTS response
    --interactive      Text-based interactive mode (type as the caller)

Usage:
    python agent.py --interactive
    python agent.py --audio path/to/recording.wav

Related integrations from this directory:
    - STT API call pattern: see ../stt-as-langchain-tool/ for LangChain tool wrapper
    - TTS API call pattern: see ../tts-as-langchain-tool/ for LangChain tool wrapper
    - Minimal snippets: see ../snippets/ for copy-paste STT/TTS tools
"""

import io
import os
import sys
import time
import wave
import argparse
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

from voice_chain import VoiceAgent

PULSE_STT_URL = "https://api.smallest.ai/waves/v1/stt/"
LIGHTNING_TTS_URL = "https://api.smallest.ai/waves/v1/tts"
SMALLEST_API_KEY = os.environ.get("SMALLEST_API_KEY", "")


def transcribe_audio(audio_path: str, language: str = "en") -> str:
    """
    Transcribe an audio file using Pulse STT.
    
    Note: This is a direct API call. For a reusable LangChain tool wrapper,
    see ../stt-as-langchain-tool/stt_tool.py or ../snippets/stt_tool.py
    """
    path = Path(audio_path)
    if not path.exists():
        print(f"Error: file not found: {audio_path}")
        sys.exit(1)

    print(f"Transcribing: {path.name}...")

    with open(path, "rb") as f:
        audio_data = f.read()

    resp = requests.post(
        PULSE_STT_URL,
        headers={
            "Authorization": f"Bearer {SMALLEST_API_KEY}",
            "Content-Type": "application/octet-stream",
        },
        params={"model": "pulse", "language": language},
        data=audio_data,
        timeout=120,
    )

    if resp.status_code != 200:
        print(f"STT failed ({resp.status_code}): {resp.text}")
        sys.exit(1)

    data = resp.json()
    transcript = data.get("transcription", data.get("text", ""))
    print(f"Transcript: {transcript}")
    return transcript


def wrap_wav(pcm_data: bytes, sample_rate: int = 24000) -> bytes:
    """Wrap raw PCM bytes in a WAV container."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    return buffer.getvalue()


def synthesize_speech(
    text: str,
    output_dir: str = "output",
    voice_id: str = "magnus",
    sample_rate: int = 24000,
) -> str:
    """Generate speech using Lightning TTS. Returns path to audio file."""
    if not text.strip():
        return ""

    print(f"Generating speech...")

    resp = requests.post(
        LIGHTNING_TTS_URL,
        headers={
            "Authorization": f"Bearer {SMALLEST_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": voice_id,
            "sample_rate": sample_rate,
        },
        timeout=30,
    )

    if resp.status_code != 200:
        print(f"TTS failed ({resp.status_code}): {resp.text}")
        return ""

    wav_bytes = wrap_wav(resp.content, sample_rate)

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"response_{int(time.time() * 1000)}.wav"
    out_path = out_dir / filename
    out_path.write_bytes(wav_bytes)
    print(f"Audio saved: {out_path}")
    return str(out_path)


def run_audio_mode(audio_path: str, generate_tts: bool = True):
    """Full pipeline: audio file → STT → agent → TTS."""
    if not SMALLEST_API_KEY:
        print("Error: SMALLEST_API_KEY not set in .env")
        sys.exit(1)

    agent = VoiceAgent()

    transcript = transcribe_audio(audio_path)
    if not transcript:
        print("No speech detected.")
        return

    response = agent.turn(transcript)
    print(f"\nAgent response: {response}")

    if generate_tts:
        audio_out = synthesize_speech(response)
        if audio_out:
            print(f"Play the response: {audio_out}")


def run_interactive_mode(generate_tts: bool = False):
    """Interactive text mode — type as the caller, agent responds."""
    agent = VoiceAgent()

    print("\nVoice AI Agent (interactive mode)")
    print("Type your messages. The agent will respond as if on a phone call.")
    print("Type 'quit' to exit, 'reset' to clear memory.")
    print("=" * 48)

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() == "quit":
            print("Goodbye!")
            break
        if user_input.lower() == "reset":
            agent.reset()
            print("Memory cleared. Starting fresh.")
            continue

        response = agent.turn(user_input)
        print(f"\nAgent: {response}")

        if generate_tts and SMALLEST_API_KEY:
            synthesize_speech(response)


def main():
    parser = argparse.ArgumentParser(description="Voice AI Agent — LangChain + Smallest AI")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--audio", type=str, help="Path to audio file to process")
    group.add_argument("--interactive", action="store_true", help="Interactive text mode")
    parser.add_argument("--speak", action="store_true", help="Generate audio response using TTS")
    parser.add_argument("--language", type=str, default="en", help="STT language (default: en)")

    args = parser.parse_args()

    if args.audio:
        run_audio_mode(args.audio, generate_tts=args.speak)
    elif args.interactive:
        run_interactive_mode(generate_tts=args.speak)


if __name__ == "__main__":
    main()
