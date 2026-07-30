#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Realtime Transcription

Gradio web interface for real-time speech-to-text transcription.
Speak into your microphone and see live transcription.

Usage: python app.py

Output:
- Web interface at http://localhost:7860
"""

import os

import gradio as gr
import numpy as np
from dotenv import load_dotenv

from stt_session import TranscriptionSession

load_dotenv()

WS_URL = "wss://api.smallest.ai/waves/v1/pulse/get_text"
SAMPLE_RATE = 16000
API_KEY = os.environ.get("SMALLEST_API_KEY")
if API_KEY is None:
    print("Error: SMALLEST_API_KEY environment variable not set")
    exit(1)


def process_audio(audio, history, session, is_recording):
    if audio is None:
        if is_recording:
            session.end_session()
            session.close()
        return history or "", session, False

    sr, audio_data = audio

    if len(audio_data) == 0:
        return history or "", session, is_recording

    if not is_recording:
        session.start(
            api_key=API_KEY,
            ws_url=WS_URL,
            language="en",
            sample_rate=SAMPLE_RATE,
        )
        is_recording = True

    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)

    if audio_data.dtype != np.int16:
        if audio_data.dtype in [np.float32, np.float64]:
            audio_data = (audio_data * 32768).clip(-32768, 32767).astype(np.int16)
        else:
            audio_data = audio_data.astype(np.int16)

    if sr != SAMPLE_RATE:
        import librosa
        audio_float = audio_data.astype(np.float32) / 32768.0
        audio_resampled = librosa.resample(audio_float, orig_sr=sr, target_sr=SAMPLE_RATE)
        audio_data = (audio_resampled * 32768).clip(-32768, 32767).astype(np.int16)

    session.send_audio(audio_data.tobytes())

    current = session.get_transcript()
    return current, session, is_recording


def clear_history(session):
    session.close()
    session.prev = ""
    return "", session, False


with gr.Blocks(
    title="Realtime Transcription",
    theme=gr.themes.Soft(primary_hue="emerald"),
) as app:
    gr.Markdown("# Realtime Transcription")
    gr.Markdown("Speak into your microphone for live transcription")

    session_state = gr.State(TranscriptionSession())
    is_recording_state = gr.State(False)

    audio_input = gr.Audio(
        sources=["microphone"],
        streaming=True,
        label="Microphone",
    )

    transcript_output = gr.Textbox(
        label="Transcript",
        lines=8,
        interactive=False,
    )

    clear_btn = gr.Button("Clear")

    audio_input.stream(
        fn=process_audio,
        inputs=[audio_input, transcript_output, session_state, is_recording_state],
        outputs=[transcript_output, session_state, is_recording_state],
    )

    clear_btn.click(
        fn=clear_history,
        inputs=[session_state],
        outputs=[transcript_output, session_state, is_recording_state],
    )


if __name__ == "__main__":
    app.launch()
