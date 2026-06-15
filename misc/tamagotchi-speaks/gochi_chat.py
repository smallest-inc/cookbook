#!/usr/bin/env python3
"""gochi_chat.py — ask gochi a question out loud, it answers out loud and with an expression.

Flow:
  1. Press Enter → speak your question → press Enter to stop
  2. Pulse STT transcribes what you asked
  3. GPT-4o-mini generates a short gochi answer + picks an expression
  4. Gochi shows the face immediately, then speaks the answer via Lightning TTS
"""

import base64
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import wave

import numpy as np
import requests
import sounddevice as sd
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont

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

_FONT = ImageFont.load_default(size=12)

def _to_b64(img: Image.Image) -> str:
    pix = list(img.getdata())
    buf = bytearray(1024)
    for row in range(64):
        for cb in range(16):
            b = 0
            for bit in range(8):
                if pix[row * 128 + cb * 8 + bit]:
                    b |= (1 << (7 - bit))
            buf[row * 16 + cb] = b
    return base64.b64encode(bytes(buf)).decode()

# Varied mouth sequence — avoids mechanical feel, reaches wide-open infrequently
_MOUTH_SEQ = [0, 1, 2, 1, 0, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 0, 1, 3, 2, 1, 0]

def _make_frame(mouth: int, blink: bool, text: str, text_x: int) -> str:
    """One animation frame: speaking face (top) + scrolling text (bottom)."""
    img  = Image.new("1", (128, 64), 0)
    draw = ImageDraw.Draw(img)

    # Eyes — blink closes them to a line
    for ex in (42, 78):
        if blink:
            draw.line([(ex, 14), (ex + 14, 14)], fill=1, width=2)
        else:
            draw.ellipse([ex, 7, ex + 14, 21], outline=1)
            draw.ellipse([ex + 4, 11, ex + 10, 17], fill=1)

    # Mouth — 4 states: closed / barely open / medium / wide with teeth hint
    mx0, mx1, my = 50, 78, 33
    if mouth == 0:
        draw.line([(mx0, my), (mx1, my)], fill=1, width=2)
    elif mouth == 1:
        draw.ellipse([mx0, my - 2, mx1, my + 2], outline=1)
    elif mouth == 2:
        draw.ellipse([mx0, my - 5, mx1, my + 5], outline=1)
    else:  # wide open — dark interior + tooth lines
        draw.ellipse([mx0, my - 8, mx1, my + 8], outline=1)
        draw.ellipse([mx0 + 2, my - 6, mx1 - 2, my + 6], fill=0)
        for tx in (mx0 + 6, 64, mx1 - 6):
            draw.line([(tx, my - 6), (tx, my - 3)], fill=1, width=1)

    # Scrolling text in bottom strip
    draw.text((text_x, 50), text, fill=1, font=_FONT)

    return _to_b64(img)

def _animate_speaking(stop: threading.Event, text: str):
    tmp_img = Image.new("1", (128, 64), 0)
    text_w  = int(ImageDraw.Draw(tmp_img).textlength(text, font=_FONT))

    i, text_x = 0, 128
    while not stop.is_set():
        blink = (i % 20 == 19)  # blink once every ~3.6 s
        gochi("/image", {"data": _make_frame(_MOUTH_SEQ[i % len(_MOUTH_SEQ)], blink, text, text_x)})
        i      += 1
        text_x -= 13
        if text_x < -text_w:
            text_x = 128
        stop.wait(0.18)

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

    stop = threading.Event()
    threading.Thread(target=_animate_speaking, args=(stop, text), daemon=True).start()
    subprocess.run(["afplay", tmp], check=False)
    stop.set()
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

    print("Gochi Chat — ask anything, gochi answers out loud.  Ctrl+C to quit.")

    while True:
        try:
            run_once()
        except KeyboardInterrupt:
            print("\nBye!")
            gochi("/face", {"name": "neutral"})
            break

if __name__ == "__main__":
    main()
