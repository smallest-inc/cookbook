# Expressive TTS (Lightning v3.2)

Control emotion, pitch, volume, speaking rate, and accent — make the same voice sound happy, angry, whispering, sarcastic, or anything in between.

> **Note:** v3.2 is currently available on `waves-api.smallest.ai` only.

## Try It Now

```bash
curl -o happy.wav \
  -X POST "https://waves-api.smallest.ai/api/v1/lightning-v3.2/get_speech" \
  -H "Authorization: Bearer $SMALLEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is absolutely incredible! I cannot believe how amazing this sounds!",
    "voice_id": "natalie",
    "emotion": "excited",
    "pitch": "high-pitched",
    "volume": "normal",
    "prosody": "fast",
    "accent": "general american",
    "sample_rate": 44100,
    "output_format": "wav"
  }'
```

## Features

- **19 emotions**: happy, sad, angry, excited, calm, sarcastic, frustrated, fearful, surprised, disgusted, bored, anxious, confident, amused, empathetic, nostalgic, pleading, skeptical, neutral
- **4 pitch styles**: mid-range, high-pitched, low-pitched, breathy
- **6 volume levels**: normal, shouting, soft, whispering, muttering, loud
- **9 speaking rates**: normal, very slow, slow, fast, very fast, melodic, monotonous, hesitant, measured
- **9 accents**: general american, british, australian, indian american, scottish, irish, southern american, new york, canadian

## Usage

### Hardcoded Emotions

```bash
export SMALLEST_API_KEY="your-key"

# Generate 6 different emotional styles
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
# → Predicts: angry, high-pitched, shouting, fast
# → Generates angry_shouting_fast.wav
```

### WebSocket Streaming

```bash
python stream_expressive.py "Take a deep breath. Everything is going to be fine." --emotion calm --volume soft
```

## Important: Sample Rate

v3.2 outputs audio at **44100 Hz** (not 24000 like v3.1). Using 24000 will make audio sound muffled.

## What's Next?

| Want to… | Go to |
|----------|-------|
| Use standard TTS (v3.1) | [Getting Started](../getting-started/) |
| Build a voice game with emotions | [Chinese Whispers Game](../voice-chinese-whispers/) |
| Browse all voices | [Voices](../voices/) |
