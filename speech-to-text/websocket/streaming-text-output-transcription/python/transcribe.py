#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Streaming Transcription

Stream an audio file through the WebSocket API and get transcription responses.
All transcripts are appended to a text file. Console shows only final transcripts.

Usage: python transcribe.py <audio_file>

Output:
- Console shows final transcripts (is_final=true)
- {filename}_responses.txt - All transcripts as plain text
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlencode

import librosa
import numpy as np
import websockets

WS_URL = "wss://waves-api.smallest.ai/api/v1/lightning/get_text"
OUTPUT_DIR = "."

# The following are all the features supported by the WebSocket endpoint (Streaming API)
LANGUAGE = "hi"
ENCODING = "linear16"
SAMPLE_RATE = 16000
WORD_TIMESTAMPS = False
FULL_TRANSCRIPT = True
SENTENCE_TIMESTAMPS = False
DIARIZE = False
REDACT_PII = False
REDACT_PCI = False
NUMERALS = "auto"
KEYWORDS = []


async def transcribe(audio_file: str, api_key: str, on_response):
    params = {
        "language": LANGUAGE,
        "encoding": ENCODING,
        "sample_rate": SAMPLE_RATE,
        "word_timestamps": str(WORD_TIMESTAMPS).lower(),
        "full_transcript": str(FULL_TRANSCRIPT).lower(),
        "sentence_timestamps": str(SENTENCE_TIMESTAMPS).lower(),
        "diarize": str(DIARIZE).lower(),
        "redact_pii": str(REDACT_PII).lower(),
        "redact_pci": str(REDACT_PCI).lower(),
        "numerals": str(NUMERALS).lower() if isinstance(NUMERALS, bool) else NUMERALS,
    }
    if KEYWORDS:
        params["keywords"] = json.dumps(KEYWORDS)

    url = f"{WS_URL}?{urlencode(params)}"
    headers = {"Authorization": f"Bearer {api_key}"}

    audio, _ = librosa.load(audio_file, sr=SAMPLE_RATE, mono=True)
    chunk_duration = 0.1
    chunk_size = int(chunk_duration * SAMPLE_RATE)

    async with websockets.connect(url, additional_headers=headers) as ws:
        async def send_audio():
            for i in range(0, len(audio), chunk_size):
                chunk = audio[i:i + chunk_size]
                pcm16 = (chunk * 32768.0).astype(np.int16).tobytes()
                await ws.send(pcm16)
                await asyncio.sleep(chunk_duration)
            await ws.send(json.dumps({"type": "end"}))

        async def receive_responses():
            async for message in ws:
                result = json.loads(message)
                on_response(result)
                if result.get("is_last"):
                    break

        await asyncio.gather(send_audio(), receive_responses())


# This function is designed to process feature outputs for all the features supported
# by the WebSocket endpoint (Streaming API)
def process_response(result: dict, output_file: Path):
    transcript = result.get("transcript", "")
    if transcript:
        with open(output_file, "a", encoding="utf-8") as f:
            f.write(transcript + "\n")

    if result.get("is_final"):
        transcript = result.get("transcript", "")
        if result.get("is_last"):
            print(f"[FINAL] {transcript}")

            if result.get("full_transcript"):
                print("\n" + "=" * 60)
                print("FULL TRANSCRIPT")
                print("=" * 60)
                print(result.get("full_transcript"))

            # Language
            if result.get("language"):
                print("\n" + "-" * 60)
                print("LANGUAGE")
                print("-" * 60)
                print(f"Detected: {result.get('language')}")
                if result.get("languages"):
                    print(f"All: {result.get('languages')}")

            # Utterances (speaker diarization)
            if result.get("utterances"):
                print("\n" + "-" * 60)
                print("UTTERANCES")
                print("-" * 60)
                for utt in result["utterances"]:
                    speaker = utt.get("speaker", "")
                    start = utt.get("start", 0)
                    end = utt.get("end", 0)
                    text = utt.get("text", "")
                    if speaker != "":
                        print(f"[{start:.2f}s - {end:.2f}s] speaker_{speaker}: {text}")
                    else:
                        print(f"[{start:.2f}s - {end:.2f}s] {text}")

            # Word timestamps
            if result.get("words"):
                print("\n" + "-" * 60)
                print("WORD TIMESTAMPS")
                print("-" * 60)
                for word in result["words"]:
                    start = word.get("start", 0)
                    end = word.get("end", 0)
                    text = word.get("word", "")
                    confidence = word.get("confidence", 0)
                    speaker = word.get("speaker", "")
                    if speaker != "":
                        print(f"[{start:.2f}s - {end:.2f}s] speaker_{speaker}: {text} ({confidence:.2f})")
                    else:
                        print(f"[{start:.2f}s - {end:.2f}s] {text} ({confidence:.2f})")

            # Redacted entities
            if result.get("redacted_entities"):
                print("\n" + "-" * 60)
                print("REDACTED ENTITIES")
                print("-" * 60)
                for entity in result["redacted_entities"]:
                    print(f"  {entity}")

            print("\n" + "=" * 60)
        else:
            print(f"{transcript}", end="", flush=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file>")
        sys.exit(1)

    audio_file = sys.argv[1]
    api_key = os.environ.get("SMALLEST_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    audio_path = Path(audio_file)
    if not audio_path.exists():
        print(f"Error: File not found: {audio_file}")
        sys.exit(1)

    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{audio_path.stem}_responses.txt"

    if output_file.exists():
        output_file.unlink()

    print(f"Streaming: {audio_path.name}")
    print(f"Responses saved to: {output_file}")
    print("-" * 60)

    asyncio.run(transcribe(
        audio_file,
        api_key,
        lambda result: process_response(result, output_file)
    ))

    print("-" * 60)
    print(f"Done!")


if __name__ == "__main__":
    main()
