#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Multilingual Live Captions

Capture microphone audio, stream it to Pulse STT with automatic language
detection, translate the transcript on-the-fly, and render a live SRT preview
for events or streams.

Usage:
    uv run app.py

Outputs:
    - Live source transcript (auto language detect)
    - Live translated captions
    - SRT preview you can copy into players/overlays
"""

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

import gradio as gr
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from subtitle_utils import generate_srt
from stt_session import TranscriptionSession

load_dotenv()

WS_URL = "wss://api.smallest.ai/waves/v1/pulse/get_text"
SAMPLE_RATE = 16000
API_KEY = os.environ.get("SMALLEST_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

if API_KEY is None:
    raise SystemExit("Error: SMALLEST_API_KEY environment variable not set")

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def translate_text(text: str, target_language: str) -> str:
    if not text or target_language.lower() == "same as source" or not openai_client:
        return text
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"Translate to {target_language}. Keep concise for subtitles."},
                {"role": "user", "content": text},
            ],
            max_tokens=120,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return text



@dataclass
class CaptionAccumulator:
    entries: List[dict] = field(default_factory=list)
    last_end: float = 0.0
    detected_language: str = "auto"
    last_source: str = ""
    last_translation: str = ""

    def add(self, source: str, translation: str, start: float, end: float, detected_language: str):
        self.entries.append({"translation": translation, "start": start, "end": end})
        self.last_end = end
        self.last_source = source
        self.last_translation = translation
        self.detected_language = detected_language or self.detected_language

    def reset(self):
        self.entries.clear()
        self.last_end = 0.0
        self.last_source = ""
        self.last_translation = ""
        self.detected_language = "auto"

    def to_srt(self) -> str:
        return generate_srt(self.entries, text_key="translation", start_key="start", end_key="end")


def resample_audio(audio: np.ndarray, sr: int) -> np.ndarray:
    if sr == SAMPLE_RATE:
        return audio
    duration = len(audio) / sr
    target_len = int(duration * SAMPLE_RATE)
    if target_len <= 0:
        return audio
    return np.interp(
        np.linspace(0, duration, target_len, endpoint=False),
        np.linspace(0, duration, len(audio), endpoint=False),
        audio
    )


def process_audio(audio, target_language, captions_state: CaptionAccumulator, session: TranscriptionSession, is_recording: bool):
    if audio is None:
        session.end_session()
        session.close()
        captions_state.reset()
        return "", "", "", captions_state, session, False

    sr, audio_data = audio
    if audio_data is None or len(audio_data) == 0:
        return captions_state.last_source, captions_state.last_translation, captions_state.to_srt(), captions_state, session, is_recording

    if not is_recording:
        captions_state.reset()
        session.start(
            api_key=API_KEY,
            ws_url=WS_URL,
            language="multi",
            sample_rate=SAMPLE_RATE,
            raise_on_error=True,
        )
        is_recording = True

    if audio_data.ndim > 1:
        audio_data = audio_data.mean(axis=1)
    
    audio_data = resample_audio(audio_data.astype(np.float32), sr)
    audio_int16 = (np.clip(audio_data, -1.0, 1.0) * 32768).astype(np.int16)
    session.send_audio(audio_int16.tobytes())

    for result in session.consume_results():
        if result.get("error"):
            captions_state.last_source = f"Error: {result['error']}"
            continue

        text = result.get("transcript", "")
        if not text:
            continue

        lang = result.get("detected_language") or result.get("language") or captions_state.detected_language
        start = result.get("start", captions_state.last_end)
        end = result.get("end", start + max(1.5, len(text.split()) * 0.4))

        translation = translate_text(text, target_language)
        captions_state.add(text, translation, float(start), float(end), lang)

    return (
        f"[{captions_state.detected_language}] {captions_state.last_source}",
        captions_state.last_translation,
        captions_state.to_srt(),
        captions_state,
        session,
        is_recording,
    )


def clear_all(captions_state: CaptionAccumulator, session: TranscriptionSession):
    session.end_session()
    session.close()
    captions_state.reset()
    return "", "", "", captions_state, session, False


with gr.Blocks(
    title="Multilingual Live Captions",
    theme=gr.themes.Soft(primary_hue="indigo"),
) as app:
    gr.Markdown("# Multilingual Live Captions")
    gr.Markdown(
        "Auto-detect speech, translate on the fly, and copy an SRT preview for your event or stream."
    )

    captions_state = gr.State(CaptionAccumulator())
    session_state = gr.State(TranscriptionSession())
    is_recording_state = gr.State(False)

    target_lang = gr.Dropdown(
        choices=[
            "Same as source",
            "English",
            "Spanish",
            "French",
            "German",
            "Hindi",
            "Portuguese",
            "Japanese",
        ],
        value="English",
        label="Subtitle language",
    )

    audio_input = gr.Audio(
        sources=["microphone"],
        streaming=True,
        type="numpy",
        sample_rate=SAMPLE_RATE,
        label="Microphone (live)",
    )

    transcript_output = gr.Textbox(
        label="Live transcript (auto language detect)",
        lines=4,
        interactive=False,
    )
    translation_output = gr.Textbox(
        label="Translated captions",
        lines=4,
        interactive=False,
    )
    subtitle_output = gr.Code(
        label="SRT Preview",
        language="text",
    )

    clear_btn = gr.Button("Stop & Clear")

    audio_input.stream(
        fn=process_audio,
        inputs=[audio_input, target_lang, captions_state, session_state, is_recording_state],
        outputs=[
            transcript_output,
            translation_output,
            subtitle_output,
            captions_state,
            session_state,
            is_recording_state,
        ],
    )

    clear_btn.click(
        fn=clear_all,
        inputs=[captions_state, session_state],
        outputs=[
            transcript_output,
            translation_output,
            subtitle_output,
            captions_state,
            session_state,
            is_recording_state,
        ],
    )


if __name__ == "__main__":
    app.launch()
