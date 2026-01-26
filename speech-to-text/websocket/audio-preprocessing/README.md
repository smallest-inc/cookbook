# Audio Preprocessing for WebSocket Streaming

Optimize audio files for low-latency WebSocket streaming. This cookbook converts audio to linear16 PCM format and provides utilities for chunking audio data for real-time transmission.

> **For file transcription (non-streaming)**, see [Audio Preprocessing](../../audio-preprocessing/).

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

Install Python dependencies:

```bash
pip install websockets
```

### Basic Usage

```bash
# Preprocess an audio file for streaming (outputs filename_streaming.wav)
python python/preprocess.py podcast.mp3

# Specify custom output path
python python/preprocess.py podcast.mp3 stream_ready.wav
```

### Preprocess and Stream

Run the full pipeline—preprocess, connect to WebSocket, stream chunks, and get transcription:

```bash
export SMALLEST_API_KEY="your-api-key"
python python/stream_with_preprocess.py podcast.mp3
```

This preprocesses the audio, streams it through the Pulse STT WebSocket API, and displays the transcript in real-time.

---

## Configuration

Edit the constants at the top of `preprocess.py` to customize the streaming behavior:

```python
TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
CHUNK_SIZE = 4096
CHUNK_INTERVAL_MS = 100
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TARGET_SAMPLE_RATE` | `16000` | Output sample rate in Hz. 16 kHz provides the best balance between latency and accuracy for speech. |
| `TARGET_CHANNELS` | `1` | Number of audio channels. Mono is required for streaming. |
| `CHUNK_SIZE` | `4096` | Size of each audio chunk in bytes. At 16 kHz mono 16-bit, this equals ~128ms of audio. |
| `CHUNK_INTERVAL_MS` | `100` | Time between sending chunks in milliseconds. Should roughly match the audio duration per chunk. |

---

## Understanding Chunking

When streaming audio over WebSocket, you send the audio in small pieces called **chunks**. Proper chunking is essential for low latency and smooth transcription.

### Why Chunk Size Matters

The chunk size affects both latency and reliability:

- **Too small** (< 1024 bytes): High overhead from frequent sends, may cause choppy transcription
- **Too large** (> 16384 bytes): Higher latency, longer wait before getting transcription results
- **Recommended** (4096 bytes): Good balance—about 128ms of audio at 16 kHz

### Calculating Chunk Duration

For 16 kHz mono 16-bit audio:

```
Bytes per second = Sample Rate × Bytes per Sample × Channels
                 = 16000 × 2 × 1 = 32,000 bytes/sec

Chunk duration = Chunk Size / Bytes per second
               = 4096 / 32000 = 0.128 seconds (128ms)
```

## Linear16 PCM Format

WebSocket streaming requires **uncompressed** audio in linear16 PCM format. This is different from file transcription where you can send MP3 or other compressed formats.

### What is Linear16 PCM?

- **Linear**: Audio samples are stored as linear (uncompressed) values
- **16-bit**: Each sample uses 16 bits (2 bytes), giving 65,536 possible amplitude levels
- **Little-endian**: Bytes are ordered with the least significant byte first (standard for most systems)

### Why Linear16 for Streaming?

1. **No decoding overhead**: The server can process samples immediately without decompression
2. **Predictable timing**: Fixed bytes-per-second makes chunking straightforward
3. **Low latency**: No buffering needed for codec frames

The trade-off is larger data size compared to compressed formats, but for real-time streaming, the latency benefit outweighs the bandwidth cost.

---

## Handling WebSocket Responses

The WebSocket API returns different types of responses as you stream audio:

| Response Type | `is_final` | Description |
|---------------|------------|-------------|
| Partial | `false` | Quick, lower-accuracy transcript—good for showing immediate feedback |
| Final | `true` | Accurate transcript for the segment—use this for storage |
| Last | `is_last: true` | Final response of the session—streaming is complete |

```python
async for message in websocket:
    data = json.loads(message)
    
    if data.get("is_final"):
        print(data["transcript"])  # Accurate segment transcript
    
    if data.get("is_last"):
        break  # Session complete
```

For the best user experience, display partial transcripts for immediate feedback, but store only the final transcripts.

---

## FFmpeg Commands

These are the underlying FFmpeg commands used by the preprocessing scripts.

### Convert to Streaming Format

```bash
ffmpeg -i input.mp3 -vn -ar 16000 -ac 1 -acodec pcm_s16le output.wav
```

### Extract Audio from Video

```bash
ffmpeg -i video.mp4 -vn -ar 16000 -ac 1 -acodec pcm_s16le output.wav
```

---

## FFmpeg Flags Explained

| Flag | Description |
|------|-------------|
| `-i input.mp3` | Specifies the input file |
| `-ar 16000` | Sets the sample rate to 16,000 Hz (16 kHz) |
| `-ac 1` | Converts to mono (1 channel) |
| `-acodec pcm_s16le` | Encodes as linear PCM 16-bit little-endian |
| `-vn` | Removes video stream (keeps only audio) |
| `-y` | Overwrites output file without asking |

---

## Supported Formats

**Audio:** WAV, MP3, FLAC, OGG, M4A, AAC, WMA, AIFF

**Video:** MP4, MKV, AVI, MOV, WebM (audio will be extracted automatically)

---

## References

- [Pulse STT Realtime Best Practices](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text/realtime/best-practices)
- [WebSocket Response Format](https://waves-docs.smallest.ai/v4.0.0/content/speech-to-text-new/realtime/response-format)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
