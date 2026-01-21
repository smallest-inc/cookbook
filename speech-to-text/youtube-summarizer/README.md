# YouTube Summarizer (YT Summarizer)

A lightning-fast tool to transcribe and summarize YouTube videos or uploaded audio files. Powered by **Smallest AI Pulse** for ultra-low latency transcription and **Groq** for instant summarization.

## Features

- **Pure Speed**: Leverages Pulse STT for sub-200ms transcription latency.
- **Smart Summaries**: Uses Groq (Llama 3) to extract executive summaries and key takeaways.
- **Flexible Input**: Supports both YouTube URLs and direct file uploads (MP3, MP4, WAV).
- **Latency Metrics**: Visualizes the precise time taken for STT (Network) vs LLM (Processing).

## Requirements

- **streamlit**: `pip install streamlit`
- **yt-dlp**: `pip install yt-dlp`
- **groq**: `pip install groq`
- **ffmpeg**: System dependency (required for audio extraction)

## Environment Variables

Create a `.env` file in the directory:

```bash
export SMALLEST_API_KEY="your-smallest-pulse-key"
export GROQ_API_KEY="your-groq-api-key"
```

## Usage

```bash
streamlit run app.py
```

## How It Works

1. **Extraction**: `yt-dlp` extracts audio from the YouTube video (or reads uploaded bytes).
2. **Transcription**: **Pulse STT** receives the raw audio stream and returns text in milliseconds.
3. **Analysis**: **Groq** processes the transcript to generate a structured summary and "Value Density" score.
4. **Display**: Results are rendered instantly with a focus on speed metrics.

## Supported Formats

- **YouTube Links**: Standard Video URLs
- **Uploads**: MP3, WAV, M4A, MP4, MOV

## Customization

You can modify `process_pulse_metadata` to re-enable paralinguistic features (Age, Gender, Emotion) if needed, which Pulse supports natively.
