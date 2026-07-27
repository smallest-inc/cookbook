"""
TTS WebSocket — Python
Stream speech via WebSocket and report time-to-first-byte (TTFB).

Targets the Lightning v3.1 Pro pool on the live WebSocket endpoint. Pass
`--model lightning_v3.1` to use the standard Lightning v3.1 pool instead.

Usage:
    export SMALLEST_API_KEY="your-api-key"
    pip install websocket-client
    python websocket-python.py --text "Hello world" --voice zoravar
    python websocket-python.py --text "..." --voice meher --out hello.wav

Docs: https://docs.smallest.ai/waves/api-reference/api-reference/text-to-speech/live-tts-web-socket
"""

import argparse
import base64
import json
import os
import time
import wave

from websocket import WebSocketApp

API_KEY = os.environ["SMALLEST_API_KEY"]

WS_URL = "wss://api.smallest.ai/waves/v1/tts/live"


def synthesize(text: str, voice_id: str, model: str, sample_rate: int, output_path: str) -> None:
    audio_chunks: list[bytes] = []
    timing: dict[str, float | None] = {"start": None, "ttfb": None}

    def on_open(ws: WebSocketApp) -> None:
        timing["start"] = time.perf_counter()
        ws.send(json.dumps({
            "text": text,
            "voice_id": voice_id,
            "model": model,
            "sample_rate": sample_rate,
        }))

    def on_message(ws: WebSocketApp, message: str) -> None:
        data = json.loads(message)
        status = data.get("status") or data.get("payload", {}).get("status")

        audio_b64 = data.get("data", {}).get("audio")
        if audio_b64:
            if timing["ttfb"] is None and timing["start"] is not None:
                timing["ttfb"] = (time.perf_counter() - timing["start"]) * 1000
                print(f"TTFB {timing['ttfb']:.1f} ms")
            audio_chunks.append(base64.b64decode(audio_b64))

        if status == "error":
            raise RuntimeError(data.get("message", "Unknown error"))
        if status == "complete":
            ws.close()

    def on_error(ws: WebSocketApp, error: BaseException) -> None:
        print(f"WS error: {error}")

    ws = WebSocketApp(
        WS_URL,
        header=[f"Authorization: Bearer {API_KEY}"],
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
    )
    ws.run_forever()

    if not audio_chunks:
        raise RuntimeError("no audio received")

    pcm = b"".join(audio_chunks)
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    print(f"Saved {output_path} ({len(pcm):,} PCM bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stream TTS over WebSocket and report TTFB.")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--voice", default="meher", help="voice_id (default: meher)")
    parser.add_argument("--model", default="lightning_v3.1_pro", help="TTS pool (default: lightning_v3.1_pro)")
    parser.add_argument("--rate", type=int, default=24000, help="Sample rate in Hz (default: 24000)")
    parser.add_argument("--out", default="output.wav", help="Output WAV path (default: output.wav)")
    args = parser.parse_args()

    synthesize(args.text, args.voice, args.model, args.rate, args.out)
