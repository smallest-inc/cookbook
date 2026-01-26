#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Audio Preprocessing

Prepare audio files for optimal transcription quality.
Converts to 16 kHz mono WAV - the recommended format for Pulse STT.

Usage: python preprocess.py <input_file> [output_file]

Requirements:
- FFmpeg installed and available in PATH

Output:
- Processed audio file optimized for transcription
"""

import os
import sys
import json
import subprocess
import shutil
from pathlib import Path

TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
NORMALIZE = True       # Adjust audio to consistent loudness levels
TRIM_SILENCE = False   # Remove silence from start and end of audio
COMPRESS_TO_MP3 = False
MP3_BITRATE = "128k"


def check_ffmpeg():
    """Check if FFmpeg is installed."""
    if shutil.which("ffmpeg") is None:
        print("Error: FFmpeg not found. Please install FFmpeg:")
        print("  macOS:   brew install ffmpeg")
        print("  Ubuntu:  sudo apt install ffmpeg")
        print("  Windows: https://ffmpeg.org/download.html")
        sys.exit(1)


def get_audio_info(input_path: str) -> dict:
    """Get audio file metadata using ffprobe (FFmpeg's media analyzer tool)."""
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
            "bit_rate": int(data.get("format", {}).get("bit_rate", 0)) // 1000,
            "format": data.get("format", {}).get("format_name", "unknown"),
        }
    except subprocess.CalledProcessError:
        return {"error": "ffprobe failed"}
    except Exception as e:
        return {"error": str(e)}


def preprocess_audio(input_path: str, output_path: str = None) -> str:
    """
    Preprocess audio file for optimal transcription performance.

    Converts to 16 kHz mono WAV with optional normalization.
    """
    input_path = Path(input_path)

    if output_path is None:
        output_path = input_path.parent / f"{input_path.stem}_processed.wav"

    output_path = Path(output_path)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vn",
        "-ar", str(TARGET_SAMPLE_RATE),
        "-ac", str(TARGET_CHANNELS),
        "-sample_fmt", "s16",
    ]

    filters = []

    if NORMALIZE:
        filters.append("loudnorm=I=-16:TP=-3:LRA=11")

    if TRIM_SILENCE:
        filters.append("silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB")
        filters.append("areverse,silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB,areverse")

    if filters:
        cmd.extend(["-af", ",".join(filters)])

    cmd.append(str(output_path))

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return str(output_path)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg failed: {e.stderr}")

# This is a lossy conversion and is disabled by default.
def convert_to_mp3(input_path: str, output_path: str = None, bitrate: str = "128k") -> str:
    """Convert to MP3 for reduced file size (still good quality for transcription)."""
    input_path = Path(input_path)

    if output_path is None:
        output_path = input_path.parent / f"{input_path.stem}_compressed.mp3"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vn",
        "-ar", str(TARGET_SAMPLE_RATE),
        "-ac", str(TARGET_CHANNELS),
        "-b:a", bitrate,
        str(output_path)
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return str(output_path)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg failed: {e.stderr}")


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

    print(f"  Format: {info['format']} ({info['codec']})")
    print(f"  Sample Rate: {info['sample_rate']} Hz")
    print(f"  Channels: {info['channels']}")
    print(f"  Duration: {info['duration']:.1f}s")

    needs_processing = (
        info['sample_rate'] != TARGET_SAMPLE_RATE or
        info['channels'] != TARGET_CHANNELS or
        info['codec'] not in ['pcm_s16le', 'pcm_s16be']
    )

    if not needs_processing and output_file is None:
        print("\nAudio is already in optimal format!")
        sys.exit(0)

    print(f"\nProcessing...")

    output = preprocess_audio(input_file, output_file)
    output_format = "WAV (pcm_s16le)"

    if COMPRESS_TO_MP3:
        output = convert_to_mp3(output, None, MP3_BITRATE)
        output_format = f"MP3 ({MP3_BITRATE})"

    input_size = os.path.getsize(input_file) / (1024 * 1024)
    output_info = get_audio_info(output)
    output_size = os.path.getsize(output) / (1024 * 1024)

    print(f"\nOutput: {output}")
    print(f"  Format: {output_format}")
    print(f"  Sample Rate: {output_info['sample_rate']} Hz")
    print(f"  Channels: {output_info['channels']}")
    print(f"  Size: {output_size:.2f} MB ({(output_size/input_size)*100:.0f}% of original)")
    print(f"\nReady for Pulse STT!")


if __name__ == "__main__":
    main()
