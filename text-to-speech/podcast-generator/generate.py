#!/usr/bin/env python3
"""
Smallest AI Text-to-Speech - Podcast Generator

Generate a two-host AI podcast from any topic. Uses GPT to write a natural
conversation script, then Lightning TTS to voice each host.

Usage:
  python generate.py "The future of AI in healthcare"
  python generate.py "Space exploration" --exchanges 8 --host1-voice magnus

Output:
- podcast_output/podcast.wav  — full podcast
- podcast_output/script.txt   — generated script
- podcast_output/segment_*.wav — individual segments
"""

import argparse
import json
import os
import struct
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

API_BASE = "https://api.smallest.ai/waves/v1"
SAMPLE_RATE = 24000


def generate_script(topic: str, host1: str, host2: str, exchanges: int, llm_model: str, client: OpenAI) -> list:
    prompt = f"""Write a podcast conversation between two hosts about: "{topic}"

Rules:
- {host1} and {host2} are the hosts
- Write exactly {exchanges} exchanges (each host speaks once per exchange)
- Keep each line 1-3 sentences, conversational and engaging
- Start with {host1} introducing the topic
- End with {host2} wrapping up

Return ONLY a JSON array of objects: [{{"speaker": "{host1}", "text": "..."}}, ...]"""

    response = client.chat.completions.create(
        model=llm_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    data = json.loads(content)

    if isinstance(data, dict):
        for key in ("lines", "conversation", "script", "dialogue", "exchanges"):
            if key in data:
                return data[key]
        return list(data.values())[0] if data else []

    return data


def synthesize(text: str, voice_id: str, model: str, api_key: str) -> bytes:
    response = requests.post(
        f"{API_BASE}/{model}/get_speech",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": voice_id,
            "sample_rate": SAMPLE_RATE,
            "output_format": "wav",
        },
    )

    if response.status_code != 200:
        raise Exception(f"TTS error ({response.status_code}): {response.text}")

    return response.content


def extract_pcm(wav_data: bytes) -> bytes:
    """Strip WAV header to get raw PCM data."""
    if wav_data[:4] == b"RIFF":
        return wav_data[44:]
    return wav_data


def combine_wav(pcm_segments: list, sample_rate: int) -> bytes:
    """Combine PCM segments into a single WAV file with short pauses between segments."""
    pause = b"\x00\x00" * int(sample_rate * 0.4)  # 0.4s silence

    all_pcm = pause.join(pcm_segments)
    data_size = len(all_pcm)
    byte_rate = sample_rate * 2
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE", b"fmt ", 16, 1,
        1, sample_rate, byte_rate, 2, 16,
        b"data", data_size,
    )
    return header + all_pcm


def main():
    parser = argparse.ArgumentParser(description="Generate an AI podcast from a topic")
    parser.add_argument("topic", help="Podcast topic")
    parser.add_argument("--exchanges", type=int, default=6, help="Number of exchanges (default: 6)")
    parser.add_argument("--host1-name", default="Alex", help="Host 1 name")
    parser.add_argument("--host2-name", default="Sarah", help="Host 2 name")
    parser.add_argument("--host1-voice", default="magnus", help="TTS voice for host 1")
    parser.add_argument("--host2-voice", default="sophia", help="TTS voice for host 2")
    parser.add_argument("--model", default="lightning-v3.1", help="TTS model")
    parser.add_argument("--llm", default="gpt-4o-mini", help="LLM model for script generation")
    args = parser.parse_args()

    api_key = os.environ.get("SMALLEST_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)
    if not openai_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        sys.exit(1)

    output_dir = Path("podcast_output")
    output_dir.mkdir(exist_ok=True)

    voice_map = {
        args.host1_name: args.host1_voice,
        args.host2_name: args.host2_voice,
    }

    # 1. Generate script
    print(f'Topic: "{args.topic}"')
    print(f"Hosts: {args.host1_name} ({args.host1_voice}) & {args.host2_name} ({args.host2_voice})")
    print(f"Generating script with {args.llm}...\n")

    client = OpenAI(api_key=openai_key)
    lines = generate_script(args.topic, args.host1_name, args.host2_name, args.exchanges, args.llm, client)

    script_text = ""
    for line in lines:
        script_text += f"[{line['speaker']}] {line['text']}\n\n"

    script_path = output_dir / "script.txt"
    script_path.write_text(script_text)
    print(f"Script ({len(lines)} lines) saved to {script_path}\n")

    # 2. Synthesize each line
    pcm_segments = []

    for i, line in enumerate(lines, 1):
        speaker = line["speaker"]
        text = line["text"]
        voice = voice_map.get(speaker, args.host1_voice)

        label = f"  [{i:02d}/{len(lines):02d}] {speaker:<10}"
        print(f"{label} {text[:60]}{'...' if len(text) > 60 else ''}", end=" ", flush=True)

        wav_data = synthesize(text, voice, args.model, api_key)
        pcm = extract_pcm(wav_data)
        pcm_segments.append(pcm)

        segment_path = output_dir / f"segment_{i:03d}_{speaker}.wav"
        segment_path.write_bytes(wav_data)
        print(f"✓")

    # 3. Combine into single file
    print("\nCombining segments...")
    full_wav = combine_wav(pcm_segments, SAMPLE_RATE)
    podcast_path = output_dir / "podcast.wav"
    podcast_path.write_bytes(full_wav)

    duration_sec = (len(full_wav) - 44) / (SAMPLE_RATE * 2)
    print(f"\nPodcast saved to {podcast_path}")
    print(f"Duration: {duration_sec:.1f}s ({len(full_wav):,} bytes)")


if __name__ == "__main__":
    main()
