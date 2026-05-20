"""
Text-to-Speech Quickstart — Python
Generate speech using the unified Lightning TTS route.

Targets the Lightning v3.1 Pro pool — drop the `model` field (or set it to
`"lightning_v3.1"`) to use the standard Lightning v3.1 pool instead.

Usage:
    export SMALLEST_API_KEY="your-api-key"
    python quickstart-python.py

Docs: https://docs.smallest.ai/waves/documentation/text-to-speech-lightning/quickstart
"""

import os
import requests

API_KEY = os.environ["SMALLEST_API_KEY"]

response = requests.post(
    "https://api.smallest.ai/waves/v1/tts",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "text": "Modern problems require modern solutions.",
        "voice_id": "meher",
        "model": "lightning_v3.1_pro",
        "sample_rate": 24000,
        "speed": 1.0,
        "language": "en",
        "output_format": "wav",
    },
)

response.raise_for_status()
with open("output.wav", "wb") as f:
    f.write(response.content)
print(f"Saved output.wav ({len(response.content):,} bytes)")
