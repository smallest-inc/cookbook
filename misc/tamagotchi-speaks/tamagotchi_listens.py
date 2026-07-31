#!/usr/bin/env python3
"""tamagotchi_listens.py — unified voice demo: speak naturally, gochi draws or reacts.

Pulse STT transcribes your voice. GPT classifies the intent and gochi acts:
  - "draw a rocket"        → draws a rocket on screen
  - "I'm really tired"     → switches to sleepy face
  - "I love cats, draw one"→ draws a cat AND shows love face
  - "show text hello world"→ scrolls text on screen

Run:  python3 tamagotchi_listens.py
"""

import base64
import io
import json
import os
import re
import sys
import time
import wave

import numpy as np
import requests
import sounddevice as sd
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont
from smallestai import SmallestAI

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SMALLEST_KEY = os.environ.get("SMALLEST_API_KEY")
OPENAI_KEY   = os.environ.get("OPENAI_API_KEY")
GOCHI_URL    = "http://localhost:7474"
SAMPLE_RATE  = 16000

VALID_FACES = {"neutral","happy","sad","sleepy","excited","surprised","angry","love","shy","dead"}

# ── Prompts ────────────────────────────────────────────────────────────────────

ROUTER_PROMPT = f"""You control a physical tamagotchi pet with a 128×64 OLED screen.
Classify the user's voice input and return a JSON action object.

Action types:
  draw            — render shapes/art visually on screen
  face            — change the expression
  draw_and_face   — draw something AND change the expression
  text            — scroll a text message on screen

Key routing rules — follow these exactly:
  "write ...", "display ...", "show text ..." → ALWAYS "text", extract just the message.
  "draw ..."                                  → ALWAYS "draw", describe what to render.
  Never route "write" or "display" to draw.

Valid faces: {", ".join(sorted(VALID_FACES))}

Return ONLY valid JSON, one of these shapes:
  {{"action":"draw",          "subject":"<what to draw>"}}
  {{"action":"face",          "expression":"<face name>"}}
  {{"action":"draw_and_face", "subject":"<what to draw>", "expression":"<face name>"}}
  {{"action":"text",          "message":"<short message>"}}

Map natural language → face:
  happy/great/love/yay/wonderful → happy or excited or love
  sad/upset/miss/cry → sad
  tired/sleepy/bored/yawn → sleepy
  angry/mad/hate/frustrated → angry
  surprised/shocked/whoa/omg → surprised
  shy/embarrassed/blush → shy
  dead/awful/zombie/terrible → dead

If someone says "draw X and I feel Y" → draw_and_face.
If it's purely emotional with no drawing request → face.
If unsure → face neutral."""

DRAW_PROMPT = """You write Python PIL drawing code to render a subject on a 128x64 monochrome OLED display.

Variables in scope:
  draw              ImageDraw.Draw instance
  W=128, H=64
  WHITE=1, BLACK=0
  font_large        monospace font — use for big text  (height: 18px, ~7 chars fit across)
  font_medium       monospace font — use for medium text (height: 12px, ~10 chars fit)
  font_small        monospace font — use for small text  (height: 8px,  ~16 chars fit)
  FL=18, FM=12, FS=8  pixel heights of font_large, font_medium, font_small

Methods available:
  draw.line([(x0,y0),(x1,y1)], fill=WHITE, width=N)
  draw.ellipse([x0,y0,x1,y1], outline=WHITE)
  draw.rectangle([x0,y0,x1,y1], outline=WHITE)
  draw.polygon([(x,y),...], outline=WHITE)
  draw.arc([x0,y0,x1,y1], start_deg, end_deg, fill=WHITE)
  draw.pieslice([x0,y0,x1,y1], start_deg, end_deg, outline=WHITE)
  draw.text((x, y), "string", fill=WHITE, font=font_large)   # or font_medium / font_small
  draw.textlength("string", font=font_large)                 # returns pixel width as float — use int() on it
  # To centre text: x = int((W - draw.textlength(s, font=f)) / 2),  y = int((H - font_height) / 2)

Rules:
  - Keep all coordinates inside the canvas (x: 0-127, y: 0-63).
  - Centre the drawing and use as much of the canvas as possible.
  - When rendering text, use draw.textlength() to measure width and centre it.
  - Add key details so the subject is instantly recognisable.
  - Return ONLY raw Python. No imports, no markdown, no comments."""


# ── Audio ──────────────────────────────────────────────────────────────────────

def record_until_enter() -> np.ndarray:
    chunks = []

    def callback(indata, frames, time, status):
        chunks.append(indata.copy())

    print("  Listening... press Enter to stop.")
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


def transcribe(audio: np.ndarray) -> str:
    client = SmallestAI(api_key=SMALLEST_KEY)
    result = client.waves.speech_to_text.transcribe(
        model="pulse",
        language="en",
        request=to_wav_bytes(audio),
    )
    return (result.transcription or "").strip()


# ── Intent routing ─────────────────────────────────────────────────────────────

def route(transcript: str) -> dict:
    client = OpenAI(api_key=OPENAI_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": ROUTER_PROMPT},
            {"role": "user",   "content": transcript},
        ],
        max_tokens=80,
        temperature=0,
    )
    raw = resp.choices[0].message.content.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"action": "face", "expression": "neutral"}


# ── Drawing ────────────────────────────────────────────────────────────────────

def generate_draw_code(subject: str) -> str:
    client = OpenAI(api_key=OPENAI_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": DRAW_PROMPT},
            {"role": "user",   "content": f"Draw {subject}"},
        ],
        max_tokens=600,
        temperature=0.2,
    )
    raw = resp.choices[0].message.content.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"^```$",         "", raw, flags=re.MULTILINE)
    return raw.strip()


_FONT_PATH = "/System/Library/Fonts/Supplemental/Andale Mono.ttf"
_font_large  = ImageFont.truetype(_FONT_PATH, 18)
_font_medium = ImageFont.truetype(_FONT_PATH, 12)
_font_small  = ImageFont.truetype(_FONT_PATH, 8)


def code_to_bitmap(code: str) -> str:
    img  = Image.new("1", (128, 64), 0)
    draw = ImageDraw.Draw(img)
    scope = {
        "draw": draw, "W": 128, "H": 64, "WHITE": 1, "BLACK": 0,
        "font_large": _font_large, "font_medium": _font_medium, "font_small": _font_small,
        "FL": 18, "FM": 12, "FS": 8,
    }
    exec(compile(code, "<gpt-draw>", "exec"), scope)  # noqa: S102
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


# ── Gochi API ──────────────────────────────────────────────────────────────────

def gochi(path: str, data: dict):
    try:
        requests.post(f"{GOCHI_URL}{path}", json=data, timeout=3)
    except Exception:
        pass


def do_draw(subject: str):
    print(f"  Drawing: {subject}")
    code = generate_draw_code(subject)
    b64  = code_to_bitmap(code)
    gochi("/image", {"data": b64})

def do_face(expression: str):
    expression = expression.lower().strip()
    if expression not in VALID_FACES:
        expression = "neutral"
    print(f"  Expression: {expression}")
    gochi("/face", {"name": "neutral"})   # force view switch away from image/text first
    gochi("/face", {"name": expression})

def do_text(message: str):
    print(f"  Text: {message}")
    gochi("/text", {"text": message})
    time.sleep(max(3.0, len(message) * 0.15))
    gochi("/face", {"name": "neutral"})


# ── Main loop ──────────────────────────────────────────────────────────────────

def run_once():
    print("\nPress Enter and speak.")
    input()

    audio = record_until_enter()
    if len(audio) / SAMPLE_RATE < 0.5:
        print("  Too short — try again.")
        return

    print("  Transcribing...")
    transcript = transcribe(audio)
    if not transcript:
        print("  (nothing heard)")
        return

    print(f'  You said : "{transcript}"')
    print("  Routing...")

    action = route(transcript)
    kind   = action.get("action", "face")
    print(f"  Action   : {json.dumps(action)}")

    if kind == "draw":
        do_draw(action.get("subject", "a dot"))

    elif kind == "face":
        do_face(action.get("expression", "neutral"))

    elif kind == "draw_and_face":
        do_draw(action.get("subject", "a dot"))
        do_face(action.get("expression", "neutral"))

    elif kind == "text":
        do_text(action.get("message", ""))

    else:
        print("  (unrecognised action, doing nothing)")


def main():
    missing = [k for k, v in [("SMALLEST_API_KEY", SMALLEST_KEY), ("OPENAI_API_KEY", OPENAI_KEY)] if not v]
    if missing:
        print(f"Error: missing in .env: {', '.join(missing)}")
        sys.exit(1)

    try:
        health = requests.get(f"{GOCHI_URL}/health", timeout=3).json()
        if not health.get("connected"):
            print("Warning: gochi device not connected")
    except Exception:
        print("Warning: gochi unreachable — is the daemon running?  (gochi health)")

    print("Gochi Demo — speak naturally, gochi draws or reacts.  Ctrl+C to quit.")

    while True:
        try:
            run_once()
        except KeyboardInterrupt:
            print("\nBye!")
            gochi("/face", {"name": "neutral"})
            break


if __name__ == "__main__":
    main()
