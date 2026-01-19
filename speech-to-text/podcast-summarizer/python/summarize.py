#!/usr/bin/env python3
"""
Smallest AI Speech-to-Text - Podcast Summarizer

Transcribe a podcast (audio or video) and generate a concise summary
using OpenAI GPT-5. Extracts key points and removes unnecessary banter.

Usage: python summarize.py <audio_or_video_file>

Environment Variables:
- SMALLEST_API_KEY: Smallest AI API key
- OPENAI_API_KEY: OpenAI API key

Requirements:
- openai Python package

Output:
- Console output with summary
- {filename}_summary.md - Markdown summary file
- {filename}_transcript.txt - Full transcript
"""

import os
import sys
from pathlib import Path

import requests

API_URL = "https://waves-api.smallest.ai/api/v1/lightning/get_text"

LANGUAGE = "en"  # Use ISO 639-1 codes or "multi" for auto-detect

SUMMARIZE_PROMPT = """You are an expert podcast summarizer. Analyze the following podcast transcript and create a concise, well-structured summary.

Your task:
1. Extract the KEY POINTS and main topics discussed
2. Remove all filler words, tangents, and unnecessary banter
3. Keep only the valuable, actionable insights
4. Organize the summary with clear sections
5. Include any notable quotes if they add value

Format your response as:

## Summary
A 2-3 sentence overview of what the podcast is about.

## Key Points
- Bullet points of the main takeaways
- Focus on actionable insights
- Remove redundant information

## Topics Discussed
Brief description of each major topic covered.

## Notable Quotes (if any)
Include 1-2 impactful quotes from the conversation.

---

TRANSCRIPT:
{transcript}
"""


def transcribe(input_file: str, api_key: str) -> str:
    print("Transcribing...")

    with open(input_file, "rb") as f:
        file_data = f.read()

    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/octet-stream",
        },
        params={
            "language": LANGUAGE,
        },
        data=file_data,
        timeout=600,
    )

    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")

    result = response.json()

    if result.get("status") != "success":
        raise Exception(f"Transcription failed: {result}")

    transcript = result.get("transcription", "")
    print(f"Transcription complete: {len(transcript)} characters")
    return transcript


def summarize_with_openai(transcript: str, openai_api_key: str) -> str:
    print("Generating summary with GPT-5...")

    try:
        from openai import OpenAI
    except ImportError:
        print("Error: openai package not installed. Run: pip install openai")
        sys.exit(1)

    client = OpenAI(api_key=openai_api_key)

    response = client.chat.completions.create(
        model="gpt-5",
        messages=[
            {
                "role": "system",
                "content": "You are an expert podcast summarizer who extracts key insights and removes unnecessary content."
            },
            {
                "role": "user",
                "content": SUMMARIZE_PROMPT.format(transcript=transcript)
            }
        ],
        temperature=0.3,
        max_tokens=2000,
    )

    summary = response.choices[0].message.content
    print("Summary generated successfully")
    return summary


def main():
    if len(sys.argv) < 2:
        print("Usage: python summarize.py <audio_or_video_file>")
        sys.exit(1)

    input_file = sys.argv[1]
    smallest_api_key = os.environ.get("SMALLEST_API_KEY")
    openai_api_key = os.environ.get("OPENAI_API_KEY")

    if not smallest_api_key:
        print("Error: SMALLEST_API_KEY environment variable not set")
        sys.exit(1)

    if not openai_api_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        sys.exit(1)

    input_path = Path(input_file)
    if not input_path.exists():
        print(f"Error: File not found: {input_file}")
        sys.exit(1)

    print(f"Processing: {input_path.name}")
    print("=" * 60)

    # Step 1: Transcribe
    transcript = transcribe(input_file, smallest_api_key)

    # Save transcript
    transcript_path = input_path.with_suffix(".txt")
    transcript_path = transcript_path.with_stem(f"{input_path.stem}_transcript")
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(transcript)
    print(f"Saved transcript: {transcript_path}")

    # Step 2: Summarize
    summary = summarize_with_openai(transcript, openai_api_key)

    # Save summary
    summary_path = input_path.with_suffix(".md")
    summary_path = summary_path.with_stem(f"{input_path.stem}_summary")
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(f"# Podcast Summary: {input_path.stem}\n\n")
        f.write(summary)
    print(f"Saved summary: {summary_path}")

    # Print summary
    print("\n" + "=" * 60)
    print("PODCAST SUMMARY")
    print("=" * 60)
    print(summary)
    print("=" * 60)
    print("\nDone!")


if __name__ == "__main__":
    main()
