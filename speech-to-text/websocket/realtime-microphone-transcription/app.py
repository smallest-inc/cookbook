#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Realtime Transcription

Gradio web interface for real-time speech-to-text transcription.
Speak into your microphone and see live transcription.

Usage: python app.py

Output:
- Web interface at http://localhost:7860
"""

import json
import os
import threading
import queue
from urllib.parse import urlencode

import gradio as gr
import numpy as np
from websockets.sync.client import connect

WS_URL = "wss://waves-api.smallest.ai/api/v1/lightning/get_text"
SAMPLE_RATE = 16000
API_KEY = os.environ.get("SMALLEST_API_KEY")
if API_KEY is None:
    print("Error: SMALLEST_API_KEY environment variable not set")
    exit(1)


class TranscriptionSession:
    def __init__(self):
        self.ws = None
        self.response_queue = queue.Queue()
        self.receiver_thread = None
        self.prev = ""
        self.is_active = False

    def start(self):
        if self.is_active:
            return

        params = {
            "language": "en",
            "encoding": "linear16",
            "sample_rate": SAMPLE_RATE,
        }
        url = f"{WS_URL}?{urlencode(params)}"
        headers = {"Authorization": f"Bearer {API_KEY}"}

        try:
            self.ws = connect(url, additional_headers=headers, open_timeout=30)
        except TimeoutError:
            self.prev = "Error: Connection timed out. Please try again."
            return
        except Exception as e:
            self.prev = f"Error: {str(e)}"
            return

        self.is_active = True
        self.prev = ""

        self.receiver_thread = threading.Thread(target=self._receive_responses, daemon=True)
        self.receiver_thread.start()

    def _receive_responses(self):
        try:
            for message in self.ws:
                result = json.loads(message)
                if result.get("is_final"):
                    self.response_queue.put(result)
                if result.get("is_last"):
                    self.is_active = False
                    break
        except Exception as e:
            self.response_queue.put({"error": str(e)})

    def send_audio(self, audio_data: bytes):
        if self.ws and self.is_active:
            try:
                self.ws.send(audio_data)
            except Exception:
                pass

    def end_session(self):
        if self.ws and self.is_active:
            try:
                self.ws.send(json.dumps({"type": "end"}))
            except Exception:
                pass

    def get_transcript(self) -> str:
        while not self.response_queue.empty():
            try:
                result = self.response_queue.get_nowait()
                if result.get("error"):
                    return f"Error: {result['error']}"
                self.prev = result.get("transcript", "")
            except queue.Empty:
                break
        return self.prev

    def close(self):
        self.is_active = False
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None


session = TranscriptionSession()


def process_audio(audio, history, is_recording):
    if audio is None:
        if is_recording:
            session.end_session()
            session.close()
        return history or "", False

    sr, audio_data = audio

    if len(audio_data) == 0:
        return history or "", is_recording

    if not is_recording:
        session.start()
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
    return current, is_recording


def clear_history():
    session.close()
    session.prev = ""
    return "", False


with gr.Blocks(
    title="Realtime Transcription",
    theme=gr.themes.Soft(primary_hue="emerald"),
) as app:
    gr.Markdown("# Realtime Transcription")
    gr.Markdown("Speak into your microphone for live transcription")

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
        inputs=[audio_input, transcript_output, is_recording_state],
        outputs=[transcript_output, is_recording_state],
    )

    clear_btn.click(
        fn=clear_history,
        outputs=[transcript_output, is_recording_state],
    )


if __name__ == "__main__":
    app.launch()
