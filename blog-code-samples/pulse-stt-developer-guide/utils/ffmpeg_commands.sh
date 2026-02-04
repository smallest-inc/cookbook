#!/bin/bash
#
# FFmpeg Commands for Audio Preprocessing
#
# These commands convert audio files to the optimal format for Pulse STT:
# - Mono channel (-ac 1)
# - 16kHz sample rate (-ar 16000)
# - 16-bit PCM WAV (-acodec pcm_s16le)
#

# ============================================
# BASIC CONVERSIONS
# ============================================

# Convert MP3 to optimal WAV
ffmpeg -i input.mp3 -ar 16000 -ac 1 -acodec pcm_s16le output.wav

# Convert M4A/AAC to WAV
ffmpeg -i input.m4a -ar 16000 -ac 1 -acodec pcm_s16le output.wav

# Convert OGG to WAV
ffmpeg -i input.ogg -ar 16000 -ac 1 -acodec pcm_s16le output.wav

# Convert FLAC to WAV
ffmpeg -i input.flac -ar 16000 -ac 1 -acodec pcm_s16le output.wav


# ============================================
# EXTRACT AUDIO FROM VIDEO
# ============================================

# Extract audio from MP4 video
ffmpeg -i video.mp4 -vn -ar 16000 -ac 1 -acodec pcm_s16le audio.wav

# Extract audio from MKV video
ffmpeg -i video.mkv -vn -ar 16000 -ac 1 -acodec pcm_s16le audio.wav

# Extract audio from WebM video
ffmpeg -i video.webm -vn -ar 16000 -ac 1 -acodec pcm_s16le audio.wav


# ============================================
# SPLIT LONG AUDIO INTO CHUNKS
# ============================================

# Split into 5-minute chunks (300 seconds)
ffmpeg -i long_audio.wav -f segment -segment_time 300 -ar 16000 -ac 1 chunk_%03d.wav

# Split into 10-minute chunks
ffmpeg -i long_audio.wav -f segment -segment_time 600 -ar 16000 -ac 1 chunk_%03d.wav


# ============================================
# TRIM/CUT AUDIO
# ============================================

# Extract 30 seconds starting at 1:00
ffmpeg -i input.wav -ss 00:01:00 -t 30 -ar 16000 -ac 1 output.wav

# Extract from 1:00 to 2:30
ffmpeg -i input.wav -ss 00:01:00 -to 00:02:30 -ar 16000 -ac 1 output.wav


# ============================================
# AUDIO ENHANCEMENT
# ============================================

# Normalize audio volume
ffmpeg -i input.wav -filter:a "loudnorm" -ar 16000 -ac 1 output.wav

# Remove silence from beginning and end
ffmpeg -i input.wav -af "silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB,areverse" -ar 16000 -ac 1 output.wav

# Basic noise reduction (high frequency noise)
ffmpeg -i input.wav -af "highpass=f=200,lowpass=f=3000" -ar 16000 -ac 1 output.wav


# ============================================
# BATCH PROCESSING
# ============================================

# Convert all MP3 files in directory to WAV
for f in *.mp3; do
  ffmpeg -i "$f" -ar 16000 -ac 1 -acodec pcm_s16le "${f%.mp3}.wav"
done

# Convert all M4A files
for f in *.m4a; do
  ffmpeg -i "$f" -ar 16000 -ac 1 -acodec pcm_s16le "${f%.m4a}.wav"
done


# ============================================
# GET AUDIO INFO
# ============================================

# Show audio file information
ffprobe -v quiet -show_format -show_streams input.wav

# Get duration only
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 input.wav
