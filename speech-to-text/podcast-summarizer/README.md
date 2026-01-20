# Podcast Summarizer

Transcribe podcasts and generate concise summaries using OpenAI GPT-5. Extracts key points and removes unnecessary banter. The API handles both audio and video files directly - no preprocessing required.

## Requirements

- **openai** Python package: `pip install openai`

## Environment Variables

```bash
export SMALLEST_API_KEY="your-smallest-api-key"
export OPENAI_API_KEY="your-openai-api-key"
```

## Usage

```bash
python python/summarize.py podcast.mp3
python python/summarize.py video_podcast.mp4
```

## How It Works

1. **Transcription**: Uses Smallest AI Pulse STT to transcribe the audio/video
2. **Summarization**: Sends transcript to OpenAI GPT-5 with a specialized prompt
3. **Output**: Generates a structured Markdown summary

## Output Files

- `{filename}_transcript.txt` - Full transcript
- `{filename}_summary.md` - Structured summary with key points

## Summary Format

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
