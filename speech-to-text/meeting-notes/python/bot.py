#!/usr/bin/env python3
"""
Meeting Note-Taking Bot

Joins Google Meet, Zoom, or Microsoft Teams meetings via Recall.ai,
transcribes with Smallest AI Pulse STT, and generates notes with GPT-4o.

Usage:
    python bot.py <meet_url> [bot_name]

Examples:
    python bot.py "https://meet.google.com/abc-defg-hij" "Notes Bot"
    python bot.py "https://zoom.us/j/1234567890" "Notes Bot"
    python bot.py "https://teams.microsoft.com/l/meetup-join/..." "Notes Bot"

Environment:
    RECALL_API_KEY    - Your Recall.ai API key
    SMALLEST_API_KEY  - Your Smallest AI API key
    OPENAI_API_KEY    - Your OpenAI API key

Output:
    - {meeting_id}_audio.mp3       : Meeting audio
    - {meeting_id}_transcript.txt  : Full transcript with speaker labels
    - {meeting_id}_notes.md        : Structured meeting notes
"""

import os
import sys
import time
import requests
from datetime import datetime

RECALL_API_URL = "https://us-west-2.recall.ai/api/v1"
RECALL_API_KEY = os.environ.get("RECALL_API_KEY")

PULSE_API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"
SMALLEST_API_KEY = os.environ.get("SMALLEST_API_KEY")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

LANGUAGE = "en"
DIARIZE = True

# Intelligent name mapping requested in the prompt
MEETING_NOTES_PROMPT = """Analyze this meeting transcript and create structured meeting notes.

TRANSCRIPT:
{transcript}

---

IMPORTANT - Speaker Name Resolution:
The transcript uses generic labels like "Speaker 1", "Speaker 2", etc. Your task:
1. Look for moments where people introduce themselves or are addressed by name (e.g., "Hi John", "Thanks Sarah", "This is Mike speaking")
2. Create a mapping of speaker labels to real names when identifiable
3. Use the REAL NAMES throughout the notes (in summary, action items, quotes, etc.)
4. If a speaker's name cannot be determined, use "speaker_x" format (e.g., speaker_1, speaker_2)

Example: If Speaker 1 says "Hey everyone, this is Alex" → use "Alex" instead of "Speaker 1" everywhere
Example: If Speaker 3's name is never mentioned → use "speaker_3" as fallback

---

Generate notes in this Markdown format:

# Meeting Notes

**Date:** {date}

## Attendees
List the identified participants with their roles if mentioned.

## Summary
A 2-3 paragraph overview of the meeting's purpose and outcomes. Use real names.

## Key Discussion Points
- Point 1
- Point 2
- Point 3

## Decisions Made
- Decision 1 (include who proposed/approved if known)
- Decision 2

## Action Items
| Owner | Task | Deadline |
|-------|------|----------|
| [Real Name] | Task description | Date if mentioned |

## Notable Quotes
Include 1-2 impactful quotes with attribution to real names.

## Follow-up Topics
- Topics for the next meeting

Be concise. Focus on actionable information. Remove filler and banter. Always prefer real names over speaker labels."""


def create_bot(meeting_url: str, bot_name: str) -> dict:
    """
    Create a Recall.ai bot that joins a meeting and records audio.
    
    Args:
        meeting_url: The meeting URL (Google Meet, Zoom, Teams, etc.)
        bot_name: Display name for the bot in the meeting
    
    Returns:
        Bot details including the bot ID
    
    Raises:
        Exception: If the API request fails
    """

    # reference: https://docs.recall.ai/reference/bot_create
    response = requests.post(
        f"{RECALL_API_URL}/bot",
        headers={
            "Authorization": f"Token {RECALL_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "meeting_url": meeting_url,
            "bot_name": bot_name,
            "recording_config": {
                "audio_mixed_mp3": {},
            },
        },
    )
    
    if response.status_code not in [200, 201]:
        raise Exception(f"Failed to create bot: {response.status_code} - {response.text}")
    
    return response.json()


def get_bot_status(bot_id: str) -> dict:
    """
    Retrieve the current status and details of a bot.
    
    Args:
        bot_id: The unique identifier of the bot
    
    Returns:
        Bot status including recordings, participants, and status_changes
    """

    # reference: https://docs.recall.ai/reference/bot_retrieve
    response = requests.get(
        f"{RECALL_API_URL}/bot/{bot_id}",
        headers={"Authorization": f"Token {RECALL_API_KEY}"},
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to get bot status: {response.text}")
    
    return response.json()


def wait_for_meeting_end(bot_id: str, poll_interval: int = 10) -> dict:
    """
    Poll the bot status until the meeting ends.
    
    Prints status updates to console while waiting. The bot must be admitted
    to the meeting by a participant for recording to start.
    
    Args:
        bot_id: The unique identifier of the bot
        poll_interval: Seconds between status checks (default: 10)
    
    Returns:
        Final bot status after meeting ends
    
    Raises:
        Exception: If the bot encounters a fatal error
    """
    print("Waiting for meeting to end...")
    
    while True:
        status = get_bot_status(bot_id)
        status_changes = status.get("status_changes", [])
        
        if status_changes:
            latest = status_changes[-1]
            state = latest.get("code", "unknown")
        else:
            state = "pending"
        
        if state == "done":
            print("Meeting ended. Processing recordings...")
            return status
        elif state == "fatal":
            message = status_changes[-1].get("message", "Unknown error") if status_changes else "Unknown"
            raise Exception(f"Bot encountered an error: {message}")
        elif state == "joining_call":
            print("Bot is joining the call... (admit the bot inside the meeting)")
        elif state == "in_waiting_room":
            print("Bot is in waiting room. Please admit the bot.")
        elif state == "in_call_not_recording":
            print("Bot joined. Waiting for recording to start...")
        elif state == "in_call_recording":
            print(f"Recording...")
        elif state == "call_ended":
            print("Call ended. Processing...")
            return status
        else:
            print(f"Status: {state}")
        
        time.sleep(poll_interval)


def get_audio_url(bot_id: str, max_retries: int = 60, retry_delay: int = 5) -> str:
    """
    Wait for audio processing and retrieve the download URL.
    
    After a meeting ends, Recall.ai processes the audio. This function
    polls until the audio is ready or timeout is reached.
    
    Args:
        bot_id: The unique identifier of the bot
        max_retries: Maximum number of retry attempts (default: 60)
        retry_delay: Seconds between retries (default: 5)
    
    Returns:
        Download URL for the MP3 audio file, or None if unavailable
    """
    print("Waiting for audio to be processed...")
    
    for attempt in range(max_retries):
        status = get_bot_status(bot_id)
        recordings = status.get("recordings", [])
        
        if recordings:
            recording = recordings[0]
            media_shortcuts = recording.get("media_shortcuts", {})
            audio_mixed = media_shortcuts.get("audio_mixed")
            
            if audio_mixed:
                audio_status = audio_mixed.get("status", {}).get("code", "unknown")
                download_url = audio_mixed.get("data", {}).get("download_url")
                
                if download_url:
                    print("Audio ready!")
                    return download_url
                else:
                    print(f"  Attempt {attempt + 1}/{max_retries}: Audio status: {audio_status}")
            else:
                rec_status = recording.get("status", {}).get("code", "unknown")
                print(f"  Attempt {attempt + 1}/{max_retries}: Recording status: {rec_status}, audio_mixed not available yet")
        else:
            print(f"  Attempt {attempt + 1}/{max_retries}: No recordings yet...")
        
        time.sleep(retry_delay)
    
    print("Timeout: Audio not available after maximum retries")
    return None


# Pulse API provides support for GET request URLs (eg. https://example.mp3)
# The URL given by recall cannot be used directly with Pulse API since it is not of the above format
# Hence the need to download the audio first
def download_audio(url: str, output_path: str) -> str:
    """
    Download audio file from a URL to local disk.
    
    Args:
        url: The download URL for the audio file
        output_path: Local file path to save the audio
    
    Returns:
        The output_path where the file was saved
    
    Raises:
        Exception: If the download fails
    """
    print(f"Downloading audio...")
    
    response = requests.get(url, stream=True)
    if response.status_code != 200:
        raise Exception(f"Failed to download audio: {response.status_code}")
    
    with open(output_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"Saved: {output_path}")
    return output_path


def transcribe_with_pulse(audio_path: str) -> dict:
    """
    Transcribe audio using Smallest AI Pulse STT with speaker diarization.
    
    Args:
        audio_path: Path to the audio file to transcribe
    
    Returns:
        Transcription result with utterances and speaker labels
    
    Raises:
        Exception: If transcription fails
    """
    print("Transcribing with Pulse STT...")
    
    with open(audio_path, "rb") as f:
        audio_data = f.read()
    
    response = requests.post(
        PULSE_API_URL,
        headers={
            "Authorization": f"Bearer {SMALLEST_API_KEY}",
            "Content-Type": "application/octet-stream",
        },
        params={
            "language": LANGUAGE,
            "diarize": str(DIARIZE).lower(),
        },
        data=audio_data,
        timeout=600,
    )
    
    if response.status_code != 200:
        raise Exception(f"Transcription failed: {response.status_code} - {response.text}")
    
    result = response.json()
    
    if result.get("status") != "success":
        raise Exception(f"Transcription failed: {result}")
    
    print("Transcription complete")
    return result


def format_transcript(result: dict) -> str:
    """
    Format the transcription result into readable text with speaker labels.
    
    Args:
        result: Pulse STT response containing utterances or transcription
    
    Returns:
        Formatted transcript string with "Speaker X: text" format
    """
    lines = []
    
    if result.get("utterances"):
        for utt in result["utterances"]:
            speaker = utt.get("speaker", "Unknown")
            text = utt.get("text", "")
            if text.strip():
                lines.append(f"Speaker {speaker}: {text}")
    else:
        lines.append(result.get("transcription", ""))
    
    return "\n\n".join(lines)


def generate_notes(transcript: str) -> str:
    """
    Generate structured meeting notes from transcript using GPT-4o.
    
    The LLM intelligently maps speaker labels to real names when identifiable
    from the conversation (e.g., introductions, addressing by name).
    
    Args:
        transcript: Formatted transcript with speaker labels
    
    Returns:
        Markdown-formatted meeting notes, or None if generation fails
    """
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY not set, skipping notes generation")
        return None
    
    print("Generating meeting notes with GPT-4o...")
    
    try:
        from openai import OpenAI
    except ImportError:
        print("Error: openai package not installed. Run: pip install openai")
        return None
    
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    prompt = MEETING_NOTES_PROMPT.format(
        transcript=transcript,
        date=datetime.now().strftime("%B %d, %Y")
    )
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a professional meeting note-taker."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=4000,
    )
    
    return response.choices[0].message.content


def main():
    """
    Main entry point. Orchestrates the full pipeline:
    1. Create bot and join meeting
    2. Wait for meeting to end
    3. Download audio from Recall.ai
    4. Transcribe with Pulse STT
    5. Generate notes with GPT-4o
    """
    if len(sys.argv) < 2:
        print("Usage: python bot.py <meet_url> [bot_name]")
        print('Example: python bot.py "https://meet.google.com/abc-defg-hij" "Notes Bot"')
        sys.exit(1)
    
    if not RECALL_API_KEY:
        print("Error: RECALL_API_KEY environment variable not set")
        print("Get your API key at: https://recall.ai")
        sys.exit(1)
    
    if not SMALLEST_API_KEY:
        print("Error: SMALLEST_API_KEY environment variable not set")
        print("Get your API key at: https://smallest.ai/console")
        sys.exit(1)
    
    meeting_url = sys.argv[1]
    bot_name = sys.argv[2] if len(sys.argv) > 2 else "Notes Bot"
    meeting_id = meeting_url.split("/")[-1].replace("-", "")[:10]
    
    try:
        print(f"Creating bot to join: {meeting_url}")
        bot = create_bot(meeting_url, bot_name)
        bot_id = bot["id"]
        print(f"Bot created: {bot_id}")
        print(f"Bot will appear as: {bot_name}")
        print("-" * 50)
        
        wait_for_meeting_end(bot_id)
        
        print("\nFetching audio recording...")
        audio_url = get_audio_url(bot_id)
        
        if not audio_url:
            print("Error: No audio recording available")
            print("The meeting may have been too short or recording failed.")
            sys.exit(1)
        
        audio_path = f"{meeting_id}_audio.mp3"
        download_audio(audio_url, audio_path)
        
        result = transcribe_with_pulse(audio_path)
        transcript = format_transcript(result)
        
        if not transcript:
            print("Error: No transcript generated")
            sys.exit(1)
        
        transcript_file = f"{meeting_id}_transcript.txt"
        with open(transcript_file, "w") as f:
            f.write(transcript)
        print(f"Saved: {transcript_file}")
        
        notes = generate_notes(transcript)
        
        if notes:
            notes_file = f"{meeting_id}_notes.md"
            with open(notes_file, "w") as f:
                f.write(notes)
            print(f"Saved: {notes_file}")
            
            print("\n" + "=" * 50)
            print("MEETING NOTES")
            print("=" * 50)
            print(notes)
        
        print("\nDone!")
        
    except KeyboardInterrupt:
        print("\n\nInterrupted. Bot may still be in the meeting.")
        print("Check status at: https://recall.ai/dashboard")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
