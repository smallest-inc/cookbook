#!/usr/bin/env python3
"""
Auto-Expressive TTS — LLM reads the text and predicts the best voice parameters.

No manual labeling needed. GPT-4o-mini picks the emotion, pitch, volume,
prosody, and accent, then v3.2 renders with those settings.

Usage:
    python llm_predict_and_speak.py "WHAT DID YOU JUST SAY TO ME?!"
    python llm_predict_and_speak.py "Take a deep breath. Everything will be okay."
    python llm_predict_and_speak.py  # runs demo set
"""

import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

TTS_URL = "https://waves-api.smallest.ai/api/v1/lightning-v3.2/get_speech"

LABEL_SCHEMA = {
    "emotion": ["neutral", "happy", "sad", "angry", "excited", "calm", "sarcastic",
                 "frustrated", "fearful", "surprised", "disgusted", "bored", "anxious",
                 "confident", "amused", "empathetic", "nostalgic", "pleading", "skeptical"],
    "pitch": ["mid-range", "high-pitched", "low-pitched", "breathy"],
    "volume": ["normal", "shouting", "soft", "whispering", "muttering", "loud"],
    "prosody": ["normal", "very slow", "slow", "fast", "very fast", "melodic",
                "monotonous", "hesitant", "measured"],
    "accent": ["general american", "british", "australian", "indian american",
               "scottish", "irish", "southern american", "new york", "canadian"],
}

SYSTEM_PROMPT = f"""You are a voice direction assistant. Given text, predict the most
natural voice parameters. Return ONLY a JSON object with these keys and allowed values:
- emotion: {LABEL_SCHEMA["emotion"]}
- pitch: {LABEL_SCHEMA["pitch"]}
- volume: {LABEL_SCHEMA["volume"]}
- prosody: {LABEL_SCHEMA["prosody"]}
- accent: {LABEL_SCHEMA["accent"]}
Pick the single best value for each. Return raw JSON only, no markdown."""

DEMOS = [
    "We just won the championship! I can't believe it, we actually did it!",
    "I'm sorry to inform you that your application has been rejected.",
    "Oh sure, because that meeting couldn't have just been an email.",
    "Please don't leave me. I'm begging you, just give me one more chance.",
    "WHAT DID YOU JUST SAY TO ME?! Say that to my face!",
    "Once upon a time, in a land far far away, there lived a kind old wizard.",
    "Great news team — our revenue is up 17 percent this quarter!",
    "Shh... did you hear that sound? I think someone is outside the door.",
]


def predict_labels(text, openai_key):
    """Use GPT-4o-mini to predict voice parameters from text."""
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0.3,
        },
    )
    if response.status_code != 200:
        raise Exception(f"OpenAI error: {response.text}")
    content = response.json()["choices"][0]["message"]["content"].strip()
    # Strip markdown fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(content)


def speak(text, labels, api_key, output_file):
    """Generate speech with predicted labels."""
    response = requests.post(
        TTS_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": "natalie",
            "sample_rate": 44100,
            "output_format": "wav",
            **labels,
        },
    )
    if response.status_code != 200:
        raise Exception(f"TTS error ({response.status_code}): {response.text}")
    with open(output_file, "wb") as f:
        f.write(response.content)
    return len(response.content)


def main():
    api_key = os.environ.get("SMALLEST_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: set SMALLEST_API_KEY"); sys.exit(1)
    if not openai_key:
        print("Error: set OPENAI_API_KEY"); sys.exit(1)

    os.makedirs("output", exist_ok=True)

    texts = [" ".join(sys.argv[1:])] if len(sys.argv) > 1 else DEMOS

    for i, text in enumerate(texts, 1):
        print(f"\n[{i}/{len(texts)}] \"{text[:60]}{'...' if len(text) > 60 else ''}\"")

        # Step 1: LLM predicts voice parameters
        labels = predict_labels(text, openai_key)
        print(f"  Predicted: {labels['emotion']}, {labels['volume']}, {labels['prosody']}")

        # Step 2: Generate speech with those parameters
        filename = f"output/{i:02d}_{labels['emotion']}_{labels['volume']}_{labels['prosody']}.wav"
        size = speak(text, labels, api_key, filename)
        print(f"  Saved: {filename} ({size:,} bytes)")

    print(f"\nDone! Check the output/ folder.")


if __name__ == "__main__":
    main()
