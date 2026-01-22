# Getting Started

The simplest way to transcribe audio using Smallest AI's Pulse STT API.

## What You'll Learn

- Make a basic transcription request
- Handle the API response
- Print the transcription result

## Setup

```bash
export SMALLEST_API_KEY="your-api-key-here"
```

## Usage

### Python

```bash
pip install requests
python python/transcribe.py recording.wav
```

### JavaScript

```bash
node javascript/transcribe.js recording.wav
```

## Features

| Parameter | Description | Default |
|-----------|-------------|---------|
| `LANGUAGE` | Language code (ISO 639-1) or `multi` for auto-detect | `en` |
