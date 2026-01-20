# Subtitle Generation

Generate SRT and VTT subtitle files from audio or video files. The API handles both audio and video files directly - no preprocessing required.

## Usage

### Python

```bash
export SMALLEST_API_KEY="your-api-key"
python python/transcribe.py video.mp4
```

### JavaScript

```bash
export SMALLEST_API_KEY="your-api-key"
node javascript/transcribe.js video.mp4
```

## Output

- `{filename}.srt` - SubRip subtitle format (most compatible)
- `{filename}.vtt` - WebVTT format (web standard)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WORDS_PER_SEGMENT` | 10 | Maximum words per subtitle line |
| `MAX_SEGMENT_DURATION` | 5.0 | Maximum seconds per subtitle |

## Supported Formats

Audio: WAV, MP3, FLAC, OGG, M4A, AAC, WMA

Video: MP4, MKV, AVI, MOV, WebM, FLV, WMV, M4V

## Subtitle Formats

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
