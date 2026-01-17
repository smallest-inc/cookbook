#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Realtime Transcription

Gradio web interface for real-time speech-to-text transcription.
Speak into your microphone and see live transcription.

Usage: python app.py

Output:
- Web interface at http://localhost:7860
"""

import asyncio
import json
import os
from urllib.parse import urlencode

import gradio as gr
import numpy as np
import websockets

WS_URL = "wss://waves-api.smallest.ai/api/v1/lightning/get_text"
SAMPLE_RATE = 16000
API_KEY = os.environ.get("SMALLEST_API_KEY")


async def transcribe_audio(audio_data: bytes) -> str:
    params = {
        "language": "en",
        "encoding": "linear16",
        "sample_rate": SAMPLE_RATE,
    }
    url = f"{WS_URL}?{urlencode(params)}"
    headers = {"Authorization": f"Bearer {API_KEY}"}

    transcript = ""

    async with websockets.connect(url, additional_headers=headers) as ws:
        await ws.send(audio_data)
        await ws.send(json.dumps({"type": "end"}))

        async for message in ws:
            result = json.loads(message)
            if result.get("is_final"):
                transcript = result.get("transcript", "")
            if result.get("is_last"):
                break

    return transcript


def process_audio(audio, history):
    if audio is None:
        return history or ""

    if not API_KEY:
        return "Error: SMALLEST_API_KEY environment variable not set"

    sr, audio_data = audio

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

    try:
        transcript = asyncio.run(transcribe_audio(audio_data.tobytes()))
        if transcript:
            history = (history + " " + transcript).strip() if history else transcript
        return history
    except Exception as e:
        return f"Error: {str(e)}"


def clear_history():
    return ""


with gr.Blocks(
    title="Realtime Transcription",
    theme=gr.themes.Soft(primary_hue="emerald"),
) as app:
    gr.Markdown("# Realtime Transcription")
    gr.Markdown("Speak into your microphone for live transcription")

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
        inputs=[audio_input, transcript_output],
        outputs=[transcript_output],
    )

    clear_btn.click(
        fn=clear_history,
        outputs=[transcript_output],
    )


if __name__ == "__main__":
    app.launch()
