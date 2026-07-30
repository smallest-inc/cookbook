"""
Speech-to-Text Quickstart — Python
Transcribe audio using Pulse STT (URL-based, zero dependencies beyond requests).

Usage:
    export SMALLEST_API_KEY="your-api-key"
    python transcribe-python.py

Docs: https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/quickstart
"""

import os
import requests

API_KEY = os.environ["SMALLEST_API_KEY"]
SAMPLE_URL = "https://github.com/smallest-inc/cookbook/raw/main/speech-to-text/getting-started/samples/audio.wav"

response = requests.post(
    "https://api.smallest.ai/waves/v1/stt/",
    params={"model": "pulse", "language": "en"},
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={"url": SAMPLE_URL},
    timeout=120,
)

response.raise_for_status()
result = response.json()
print(f"Transcription: {result['transcription']}")
