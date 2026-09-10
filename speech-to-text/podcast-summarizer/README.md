# Podcast Summarizer

Transcribe podcasts and generate concise summaries using OpenAI GPT-5. Extracts key points and removes unnecessary banter. The API handles both audio and video files directly — no preprocessing required.

## Features

- Transcribe podcasts via Pulse STT
- Generate structured Markdown summaries with GPT-5
- Extracts key points, topics, and notable quotes
- Direct audio and video file support (no ffmpeg needed)
- Customizable summarization prompt

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` and `OPENAI_API_KEY` to your `.env`.

## Usage

```bash
uv run summarize.py podcast.mp3
uv run summarize.py video_podcast.mp4
```

## Recommended Usage

- Quickly distilling long podcasts or audio recordings into structured summaries
- Extracting key points, topics, and notable quotes from conversations
- For a web UI with YouTube support, [YouTube Summarizer](../youtube-summarizer/) is recommended

## How It Works

1. **Transcription**: Uses Smallest AI Pulse STT to transcribe the audio/video
2. **Summarization**: Sends transcript to OpenAI GPT-5 with a specialized prompt
3. **Output**: Generates a structured Markdown summary

## Example Output

- `{filename}_transcript.txt` — Full transcript
- `{filename}_summary.md` — Structured summary with key points

### Summary Format

The generated summary includes:

- **Summary**: 2-3 sentence overview
- **Key Points**: Bullet points of main takeaways
- **Topics Discussed**: Brief description of each major topic
- **Notable Quotes**: Impactful quotes from the conversation

## Supported Formats

Audio: WAV, MP3, FLAC, OGG, M4A, AAC, WMA

Video: MP4, MKV, AVI, MOV, WebM, FLV, WMV, M4V

## Customization

Edit the `SUMMARIZE_PROMPT` variable in the script to customize how summaries are generated.

## API Reference

- [Pulse STT API Reference](https://waves-docs.smallest.ai/api-reference/models/speech-to-text/transcribe)
- [OpenAI Chat API](https://platform.openai.com/docs/api-reference/chat)

## Next Steps

- [YouTube Summarizer](../youtube-summarizer/) — Streamlit app for YouTube videos
- [File Transcription](../file-transcription/) — Add emotions, age, gender to transcriptions
