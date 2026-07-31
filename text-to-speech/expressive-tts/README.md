# Expressive TTS (Lightning v3.2)

Control emotion, pitch, volume, speaking rate, and accent — make the same voice sound happy, angry, whispering, fearful, or anything in between.

## Try It Now

```bash
curl -o happy.wav \
  -X POST "https://api.smallest.ai/waves/v1/tts" \
  -H "Authorization: Bearer $SMALLEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is absolutely incredible! I cannot believe how amazing this sounds!",
    "voice_id": "sloane",
    "model": "lightning_v3.2",
    "emotion": "happy",
    "pitch": "high",
    "volume": "normal",
    "prosody": "fast",
    "accent": "general american",
    "sample_rate": 44100,
    "output_format": "wav"
  }'
```

## Features

- **5 emotions**: neutral, happy, sad, angry, fearful
- **3 pitch levels**: low, mid, high
- **5 volume levels**: whisper, soft, normal, loud, shouting
- **3 speaking rates**: slow, normal, fast
- **10 accents**: general american, indian american, irish, italian, new york, british, canadian, scottish, southern american, australian

## Usage

### Hardcoded Emotions

```bash
export SMALLEST_API_KEY="your-key"

# Generate the demo set of emotional styles
python expressive.py

# Or specific emotion
python expressive.py --emotion angry --accent british --text "This is unacceptable!"
```

### Auto-Detect Emotion with LLM

The LLM reads the text and predicts the best emotion, pitch, volume, prosody, and accent automatically:

```bash
export SMALLEST_API_KEY="your-key"
export OPENAI_API_KEY="your-openai-key"

python llm_predict_and_speak.py "WHAT DID YOU JUST SAY TO ME?!"
# → Predicts: angry, high, shouting, fast
# → Generates angry_shouting_fast.wav
```

## Important: Sample Rate

v3.2 outputs audio at **44100 Hz** (not 24000 like v3.1). Using 24000 will make audio sound muffled.

## What's Next?

| Want to… | Go to |
|----------|-------|
| Use standard TTS (v3.1) | [Getting Started](../getting-started/) |
| Build a voice game with emotions | [Chinese Whispers Game](../voice-chinese-whispers/) |
| Browse all voices | [Voices](../voices/) |
