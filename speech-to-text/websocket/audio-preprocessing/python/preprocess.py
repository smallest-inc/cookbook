#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Audio Preprocessing for WebSocket

Prepare audio for optimal WebSocket streaming performance.
Converts to 16 kHz mono linear16 PCM - the recommended format.

Usage: python preprocess.py <input_file> [output_file]

Requirements:
- FFmpeg installed and available in PATH

Output:
- Processed audio file optimized for WebSocket streaming
"""

import os
import sys
import json
import subprocess
import shutil
from pathlib import Path

TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
CHUNK_SIZE = 4096
CHUNK_INTERVAL_MS = 100


def check_ffmpeg():
    """Check if FFmpeg is installed."""
    if shutil.which("ffmpeg") is None:
        print("Error: FFmpeg not found. Please install FFmpeg:")
        print("  macOS:   brew install ffmpeg")
        print("  Ubuntu:  sudo apt install ffmpeg")
        print("  Windows: https://ffmpeg.org/download.html")
        sys.exit(1)


def get_audio_info(input_path: str) -> dict:
    """Get audio file metadata using ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        input_path
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)

        audio_stream = None
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "audio":
                audio_stream = stream
                break

        if not audio_stream:
            return {"error": "No audio stream found"}

        return {
            "codec": audio_stream.get("codec_name", "unknown"),
            "sample_rate": int(audio_stream.get("sample_rate", 0)),
            "channels": audio_stream.get("channels", 0),
            "duration": float(data.get("format", {}).get("duration", 0)),
        }
    except Exception as e:
        return {"error": str(e)}


def preprocess_for_streaming(input_path: str, output_path: str = None) -> str:
    """
    Preprocess audio for WebSocket streaming.

    Converts to linear16 PCM at 16 kHz mono.
    """
    input_path = Path(input_path)

    if output_path is None:
        output_path = input_path.parent / f"{input_path.stem}_streaming.wav"

    output_path = Path(output_path)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vn",
        "-ar", str(TARGET_SAMPLE_RATE),
        "-ac", str(TARGET_CHANNELS),
        "-acodec", "pcm_s16le",
        str(output_path)
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return str(output_path)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg failed: {e.stderr}")


def calculate_streaming_params(audio_path: str) -> dict:
    """Calculate optimal streaming parameters for an audio file."""
    info = get_audio_info(audio_path)

    if "error" in info:
        return info

    bytes_per_second = info["sample_rate"] * 2 * info["channels"]  # 2 bytes per sample (16-bit audio)

    return {
        "sample_rate": info["sample_rate"],
        "channels": info["channels"],
        "duration": info["duration"],
        "bytes_per_second": bytes_per_second,
        "recommended_chunk_size": CHUNK_SIZE,
        "recommended_interval_ms": CHUNK_INTERVAL_MS,
        "total_chunks": int((info["duration"] * bytes_per_second) / CHUNK_SIZE),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python preprocess.py <input_file> [output_file]")
        sys.exit(1)

    check_ffmpeg()

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    if not os.path.exists(input_file):
        print(f"Error: File not found: {input_file}")
        sys.exit(1)

    print(f"\nInput: {input_file}")
    info = get_audio_info(input_file)

    if "error" in info:
        print(f"Error: {info['error']}")
        sys.exit(1)

    print(f"  Sample Rate: {info['sample_rate']} Hz")
    print(f"  Channels: {info['channels']}")
    print(f"  Duration: {info['duration']:.1f}s")

    print(f"\nConverting to streaming format...")
    output = preprocess_for_streaming(input_file, output_file)
    params = calculate_streaming_params(output)

    print(f"\nOutput: {output}")
    print(f"  Format: Linear PCM 16-bit (pcm_s16le)")
    print(f"  Sample Rate: {TARGET_SAMPLE_RATE} Hz")
    print(f"  Channels: 1 (mono)")

    print(f"\nStreaming Parameters:")
    print(f"  Chunk Size: {params['recommended_chunk_size']} bytes")
    print(f"  Interval: {params['recommended_interval_ms']} ms")
    print(f"  Total Chunks: ~{params['total_chunks']}")

    print(f"\nReady for WebSocket streaming!")


if __name__ == "__main__":
    main()
