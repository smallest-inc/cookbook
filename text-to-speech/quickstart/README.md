# Quickstart

Generate speech from text in under 2 minutes. No config files, no environment setup — just run it.

Get your API key at [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys).

## curl (Fastest — zero install)

```bash
curl -X POST https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Smallest AI!", "voice_id": "sophia", "sample_rate": 24000, "output_format": "wav"}' \
  --output hello.wav && echo "Done! Play hello.wav"
```

Replace `YOUR_API_KEY` with your key. That's it — you'll have a WAV file in 2 seconds.

## Python

```bash
pip install requests
export SMALLEST_API_KEY="your-key"
python quickstart.py
```

## JavaScript

```bash
export SMALLEST_API_KEY="your-key"
node quickstart.js
```

## What's Next?

| Want to… | Go to |
|----------|-------|
| Choose a different voice | [Voices](../voices/) |
| Stream audio in real-time | [Streaming](../streaming/) |
| Control pronunciation | [Pronunciation Dicts](../pronunciation-dicts/) |
| Generate in other languages | [Multilingual Translator](../multilingual-translator/) |
| Generate a podcast | [Podcast Generator](../podcast-generator/) |
| Create an audiobook | [Audiobook Generator](../audiobook-generator/) |
