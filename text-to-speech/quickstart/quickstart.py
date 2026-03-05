import os, requests

response = requests.post(
    "https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech",
    headers={"Authorization": f"Bearer {os.environ['SMALLEST_API_KEY']}", "Content-Type": "application/json"},
    json={"text": "Hello! Welcome to Smallest AI. This is your first text-to-speech generation.", "voice_id": "sophia", "sample_rate": 24000, "output_format": "wav"},
)
with open("output.wav", "wb") as f:
    f.write(response.content)
print(f"Done! Saved output.wav ({len(response.content):,} bytes)")
