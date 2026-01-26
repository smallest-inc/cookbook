# Audio Preprocessing for Speech-to-Text

Optimize audio files before transcription to improve accuracy and reduce processing time. This cookbook provides tools to convert audio to the optimal format for Pulse STT.

> **For WebSocket/realtime streaming**, see [WebSocket Audio Preprocessing](../websocket/audio-preprocessing/).

---

## How to Use

### Prerequisites

Install FFmpeg, a powerful command-line tool for audio/video processing:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### Basic Usage

```bash
# Preprocess an audio file (outputs filename_processed.wav)
python python/preprocess.py podcast.mp3

# Specify custom output path
python python/preprocess.py podcast.mp3 clean_audio.wav
```

### Preprocess and Transcribe

Run the full pipeline in one command:

```bash
export SMALLEST_API_KEY="your-api-key"
python python/transcribe_with_preprocess.py podcast.mp3
```

This will preprocess the audio, send it to Pulse STT, and save the transcript. If preprocessing fails (e.g., FFmpeg error), it automatically falls back to the original file.

---

## Configuration

Edit the constants at the top of `preprocess.py` to customize the preprocessing behavior:

```python
TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
NORMALIZE = True
TRIM_SILENCE = False
COMPRESS_TO_MP3 = False
MP3_BITRATE = "128k"
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TARGET_SAMPLE_RATE` | `16000` | Output sample rate in Hz. 16 kHz is optimal for speech recognition—higher rates add file size without improving accuracy. |
| `TARGET_CHANNELS` | `1` | Number of audio channels. Mono (1) is recommended since stereo doesn't improve STT accuracy. |
| `NORMALIZE` | `True` | Adjusts audio to consistent loudness levels. Helps with quiet recordings or inconsistent volumes. |
| `TRIM_SILENCE` | `False` | Removes silence from the start and end of the audio. Useful for reducing processing time on files with long silent sections. |
| `COMPRESS_TO_MP3` | `False` | Outputs as MP3 instead of WAV. Significantly reduces file size at the cost of some audio data. |
| `MP3_BITRATE` | `"128k"` | Bitrate for MP3 compression. 128 kbps provides good quality for speech. |

---

## Reduce File Size

Converting to MP3 can dramatically reduce file size—often by **10x or more**—while still maintaining sufficient quality for transcription.

| Format | ~1 min of audio | Notes |
|--------|-----------------|-------|
| WAV (16 kHz mono) | ~1.9 MB | Lossless, maximum quality |
| MP3 (128 kbps) | ~0.9 MB | Good balance of size and quality |
| MP3 (64 kbps) | ~0.5 MB | Smaller but may affect accuracy |

To enable MP3 output, set `COMPRESS_TO_MP3 = True` in `preprocess.py`.

### Understanding Lossy Compression

MP3 is a **lossy** format, meaning some audio data is permanently discarded to achieve smaller file sizes. This is fine for speech transcription in most cases, but keep in mind:

- **Lossless formats** (WAV, FLAC) preserve all audio data and are best when maximum accuracy is critical.
- **Lossy formats** (MP3, AAC) discard some data but are much smaller.
- **Converting lossy to lossless doesn't help**—once data is lost during compression, converting MP3 to WAV won't bring it back.

For archival or high-stakes transcription, keep the original lossless file.

---

## FFmpeg Commands

These are the underlying FFmpeg commands used by the preprocessing scripts. You can run them directly if you prefer command-line control.

### Convert to Optimal WAV

```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 -sample_fmt s16 output.wav
```

### Compress to MP3

```bash
ffmpeg -i input.wav -ar 16000 -ac 1 -b:a 128k output.mp3
```

### Extract Audio from Video

```bash
ffmpeg -i video.mp4 -vn -ar 16000 -ac 1 output.wav
```

### Normalize Audio Levels

```bash
ffmpeg -i input.wav -af "loudnorm=I=-16:TP=-3:LRA=11" -ar 16000 -ac 1 output.wav
```

### Remove Silence from Start/End

```bash
ffmpeg -i input.wav -af "silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB" output.wav
```

---

## FFmpeg Flags Explained

| Flag | Description |
|------|-------------|
| `-i input.mp3` | Specifies the input file |
| `-ar 16000` | Sets the sample rate to 16,000 Hz (16 kHz) |
| `-ac 1` | Converts to mono (1 channel) |
| `-sample_fmt s16` | Uses 16-bit signed integer samples |
| `-b:a 128k` | Sets audio bitrate to 128 kbps (for MP3) |
| `-vn` | Removes video stream (keeps only audio) |
| `-af "..."` | Applies an audio filter (normalization, silence removal, etc.) |
| `-y` | Overwrites output file without asking |

---

## Supported Formats

**Audio:** WAV, MP3, FLAC, OGG, M4A, AAC, WMA, AIFF

**Video:** MP4, MKV, AVI, MOV, WebM (audio will be extracted automatically)

---

## References

- [Pulse STT Best Practices](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text/pre-recorded/best-practices)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
