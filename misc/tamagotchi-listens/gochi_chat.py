#!/usr/bin/env python3
"""gochi_chat.py — ask gochi a question out loud, it answers out loud and with an expression.

Flow:
  1. Press Enter → speak your question → press Enter to stop
  2. Pulse STT transcribes what you asked
  3. GPT-4o-mini generates a short gochi answer + picks an expression
  4. Gochi shows the face immediately, then speaks the answer via Lightning TTS
"""

import io
import json
import os
import subprocess
import sys
import tempfile
import time
import wave

import numpy as np
import requests
import sounddevice as sd
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SMALLEST_KEY = os.environ.get("SMALLEST_API_KEY")
OPENAI_KEY   = os.environ.get("OPENAI_API_KEY")
GOCHI_URL    = "http://localhost:7474"
SAMPLE_RATE  = 16000
VOICE_ID     = "austin"

SYSTEM_PROMPT = """You are Gochi — a tiny, expressive tamagotchi pet living on a 128×64 OLED screen.
You answer questions in a cute, witty, personality-filled way.

Rules:
- Answer in 10 words or fewer (the screen is tiny).
- Pick the face that best matches the mood of your answer.
- Available faces: neutral, happy, sad, sleepy, excited, surprised, angry, love, shy, dead

Respond ONLY with valid JSON, no markdown, no extra text:
{"answer": "...", "face": "..."}"""

def record_until_enter() -> np.ndarray:
    chunks = []

    def callback(indata, frames, time, status):
        chunks.append(indata.copy())

    print("  Recording... press Enter to stop.")
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16", callback=callback):
        input()

    return np.concatenate(chunks, axis=0) if chunks else np.array([], dtype="int16")

def to_wav_bytes(audio: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio.tobytes())
    return buf.getvalue()

def gochi(path: str, data: dict):
    try:
        requests.post(f"{GOCHI_URL}{path}", json=data, timeout=3)
    except Exception:
        pass

def speak(text: str):
    resp = requests.post(
        "https://api.smallest.ai/waves/v1/tts",
        headers={
            "Authorization": f"Bearer {SMALLEST_KEY}",
            "Content-Type": "application/json",
            "Accept": "audio/wav",
        },
        json={"text": text, "voice_id": VOICE_ID, "model": "lightning_v3.1_pro", "sample_rate": 24000, "output_format": "wav"},
        timeout=15,
    )
    resp.raise_for_status()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(resp.content)
        tmp = f.name
    subprocess.run(["afplay", tmp], check=False)
    os.unlink(tmp)

def transcribe(audio: np.ndarray) -> str:
    resp = requests.post(
        "https://api.smallest.ai/waves/v1/stt/",
        headers={
            "Authorization": f"Bearer {SMALLEST_KEY}",
            "Content-Type": "application/octet-stream",
        },
        params={"model": "pulse-pro", "language": "en"},
        data=to_wav_bytes(audio),
        timeout=15,
    )
    resp.raise_for_status()
    return (resp.json().get("transcription") or "").strip()

def ask_gochi(question: str):
    client = OpenAI(api_key=OPENAI_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": question},
        ],
        max_tokens=80,
        temperature=0.9,
    )
    raw = resp.choices[0].message.content.strip()
    try:
        data = json.loads(raw)
        answer = str(data.get("answer", "..."))
        face   = str(data.get("face", "neutral"))
    except (json.JSONDecodeError, AttributeError):
        answer = raw[:60]
        face   = "neutral"

    valid_faces = {"neutral","happy","sad","sleepy","excited","surprised","angry","love","shy","dead"}
    if face not in valid_faces:
        face = "neutral"

    return answer, face

def run_once():
    print("\nPress Enter to ask Gochi something.")
    input()

    audio = record_until_enter()
    if len(audio) / SAMPLE_RATE < 0.5:
        print("  Too short — try again.")
        return

    print("  Transcribing...")
    question = transcribe(audio)
    if not question:
        print("  (nothing heard)")
        return

    print(f'  You asked : "{question}"')
    print("  Thinking...")

    answer, face = ask_gochi(question)
    print(f'  Gochi says: "{answer}"  [{face}]')

    # Text scrolls on OLED while audio synthesizes + plays, then face shows
    gochi("/text", {"text": answer})
    print("  Speaking...")
    speak(answer)
    gochi("/face", {"name": face})
    time.sleep(2)
    gochi("/face", {"name": "neutral"})

def main():
    missing = [k for k, v in [("SMALLEST_API_KEY", SMALLEST_KEY), ("OPENAI_API_KEY", OPENAI_KEY)] if not v]
    if missing:
        print(f"Error: missing keys in .env: {', '.join(missing)}")
        sys.exit(1)

    try:
        health = requests.get(f"{GOCHI_URL}/health", timeout=3).json()
        if not health.get("connected"):
            print("Warning: gochi device not connected")
    except Exception:
        print("Warning: gochi unreachable — is the daemon running? (gochi health)")

    print("Gochi Chat — ask anything, gochi answers on screen.  Ctrl+C to quit.")

    while True:
        try:
            run_once()
        except KeyboardInterrupt:
            print("\nBye!")
            gochi("/face", {"name": "neutral"})
            break

if __name__ == "__main__":
    main()
