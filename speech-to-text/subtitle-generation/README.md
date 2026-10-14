# Subtitle Generation

Generate SRT and VTT subtitle files from audio or video files. The API handles both audio and video files directly — no preprocessing required.

## Features

- Generate SubRip (.srt) and WebVTT (.vtt) subtitle formats
- Configurable words per segment and max segment duration
- Direct audio and video file support (no ffmpeg needed)
- Wide format support: WAV, MP3, FLAC, MP4, MKV, MOV, and more

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env`.

## Usage

### Python

```bash
uv run python/transcribe.py video.mp4
```

### JavaScript

```bash
node javascript/transcribe.js video.mp4
```

## Recommended Usage

- Generating SRT/VTT subtitle files for video players, YouTube uploads, or accessibility
- Batch subtitling of audio and video files with configurable segment length
- For raw word timestamps without subtitle formatting, [Word-Level Outputs](../word-level-outputs/) is recommended

## How It Works

The script calls Pulse STT with word timestamps enabled, then groups words into timed subtitle segments based on configurable limits.

### SRT Format

```
1
00:00:00,000 --> 00:00:02,500
Hello, this is a sample subtitle.

2
00:00:02,500 --> 00:00:05,000
This is the second line.
```

### VTT Format

```
WEBVTT

1
00:00:00.000 --> 00:00:02.500
Hello, this is a sample subtitle.

2
00:00:02.500 --> 00:00:05.000
This is the second line.
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WORDS_PER_SEGMENT` | 10 | Maximum words per subtitle line |
| `MAX_SEGMENT_DURATION` | 5.0 | Maximum seconds per subtitle |

## Example Output

- `{filename}.srt` — SubRip subtitle format (most compatible)
- `{filename}.vtt` — WebVTT format (web standard)

## Supported Formats

Audio: WAV, MP3, FLAC, OGG, M4A, AAC, WMA

Video: MP4, MKV, AVI, MOV, WebM, FLV, WMV, M4V

## API Reference

- [Pre-recorded Quickstart](https://waves-docs.smallest.ai/models/speech-to-text/pre-recorded/quickstart)
- [Pulse STT API Reference](https://waves-docs.smallest.ai/api-reference/models/speech-to-text/transcribe)

## Next Steps

- [Word-Level Outputs](../word-level-outputs/) — Access raw word timestamps for custom formatting
- [File Transcription](../file-transcription/) — Add emotions, age, gender to transcriptions
