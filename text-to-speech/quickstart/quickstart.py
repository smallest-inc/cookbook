import os
import sys

import requests

api_key = os.environ.get("SMALLEST_API_KEY")
if not api_key:
    print("Error: set SMALLEST_API_KEY environment variable")
    print("Get your key at https://app.smallest.ai/dashboard/settings/apikeys")
    sys.exit(1)

response = requests.post(
    "https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    json={
        "text": "Hello! Welcome to Smallest AI. This is your first text-to-speech generation.",
        "voice_id": "sophia",
        "sample_rate": 24000,
        "output_format": "wav",
    },
)

if response.status_code != 200:
    print(f"Error ({response.status_code}): {response.text}")
    sys.exit(1)

with open("output.wav", "wb") as f:
    f.write(response.content)
print(f"Done! Saved output.wav ({len(response.content):,} bytes)")
