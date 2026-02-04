#!/usr/bin/env python3
"""
Audio Preprocessing Utilities for Pulse STT

Converts audio files to optimal format for STT:
- Mono channel
- 16kHz sample rate
- 16-bit PCM WAV

Usage:
    python audio_preprocessing.py input.mp3 output.wav
    python audio_preprocessing.py --chunk input.wav --duration 300

Requirements:
    pip install pydub

Note: pydub requires ffmpeg installed on your system.
"""

import argparse
import io
import sys
from pathlib import Path

try:
    from pydub import AudioSegment
except ImportError:
    print("Install pydub: pip install pydub")
    print("Also ensure ffmpeg is installed on your system")
    sys.exit(1)


def preprocess_audio(input_path: str, output_path: str = None) -> bytes:
    """
    Convert any audio format to STT-optimal WAV.
    - Mono channel
    - 16kHz sample rate
    - 16-bit PCM

    Args:
        input_path: Path to input audio file
        output_path: Optional path to save output WAV

    Returns:
        WAV audio bytes
    """
    print(f"📁 Loading: {input_path}")
    audio = AudioSegment.from_file(input_path)

    print(f"   Original: {audio.channels}ch, {audio.frame_rate}Hz, {audio.sample_width * 8}-bit")

    # Convert to mono
    audio = audio.set_channels(1)

    # Resample to 16kHz
    audio = audio.set_frame_rate(16000)

    # Ensure 16-bit
    audio = audio.set_sample_width(2)

    print(f"   Converted: 1ch, 16000Hz, 16-bit")

    # Export as WAV
    buffer = io.BytesIO()
    audio.export(buffer, format="wav")
    buffer.seek(0)
    wav_data = buffer.read()

    if output_path:
        with open(output_path, "wb") as f:
            f.write(wav_data)
        print(f"✅ Saved: {output_path}")

    return wav_data


def chunk_long_audio(
    input_path: str,
    output_dir: str,
    chunk_duration_ms: int = 300000
) -> list[str]:
    """
    Split long audio files into chunks for batch processing.

    Args:
        input_path: Path to input audio file
        output_dir: Directory to save chunks
        chunk_duration_ms: Duration of each chunk in ms (default: 5 minutes)

    Returns:
        List of output file paths
    """
    print(f"📁 Loading: {input_path}")
    audio = AudioSegment.from_file(input_path)

    # Convert to STT format
    audio = audio.set_channels(1).set_frame_rate(16000).set_sample_width(2)

    total_duration = len(audio)
    num_chunks = (total_duration + chunk_duration_ms - 1) // chunk_duration_ms

    print(f"   Duration: {total_duration / 1000:.1f}s")
    print(f"   Splitting into {num_chunks} chunks of {chunk_duration_ms / 1000}s each")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_files = []
    base_name = Path(input_path).stem

    for i, start in enumerate(range(0, total_duration, chunk_duration_ms)):
        chunk = audio[start:start + chunk_duration_ms]
        output_path = output_dir / f"{base_name}_chunk_{i:03d}.wav"

        chunk.export(output_path, format="wav")
        output_files.append(str(output_path))
        print(f"   ✅ Chunk {i + 1}/{num_chunks}: {output_path.name}")

    return output_files


def get_audio_info(input_path: str) -> dict:
    """Get information about an audio file."""
    audio = AudioSegment.from_file(input_path)

    return {
        "channels": audio.channels,
        "sample_rate": audio.frame_rate,
        "sample_width": audio.sample_width,
        "duration_seconds": len(audio) / 1000,
        "file_size_bytes": Path(input_path).stat().st_size
    }


def main():
    parser = argparse.ArgumentParser(description="Audio preprocessing for STT")
    parser.add_argument("input", help="Input audio file")
    parser.add_argument("output", nargs="?", help="Output WAV file (optional)")
    parser.add_argument("--chunk", action="store_true",
                        help="Split into chunks instead of converting")
    parser.add_argument("--duration", type=int, default=300,
                        help="Chunk duration in seconds (default: 300)")
    parser.add_argument("--info", action="store_true",
                        help="Just show audio info, don't convert")

    args = parser.parse_args()

    if not Path(args.input).exists():
        print(f"❌ File not found: {args.input}")
        sys.exit(1)

    if args.info:
        info = get_audio_info(args.input)
        print("=" * 40)
        print("📊 AUDIO INFO")
        print("=" * 40)
        print(f"  Channels:    {info['channels']}")
        print(f"  Sample rate: {info['sample_rate']} Hz")
        print(f"  Bit depth:   {info['sample_width'] * 8}-bit")
        print(f"  Duration:    {info['duration_seconds']:.2f}s")
        print(f"  File size:   {info['file_size_bytes']:,} bytes")
        return

    if args.chunk:
        output_dir = args.output or "./chunks"
        chunk_long_audio(
            args.input,
            output_dir,
            chunk_duration_ms=args.duration * 1000
        )
    else:
        output = args.output or args.input.rsplit(".", 1)[0] + "_16k.wav"
        preprocess_audio(args.input, output)


if __name__ == "__main__":
    main()
