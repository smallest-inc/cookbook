# Voice Chinese Whispers (Telephone Game)

A viral voice AI demo. A sentence passes through multiple "characters" — each with a different emotion, accent, and speaking style. Watch how the same sentence sounds completely different when said by an excited American, a sarcastic Brit, a whispering storyteller, and an angry New Yorker.

Share the results on social media — people love hearing the same sentence in wildly different styles.

## How It Works

```
Input: "I just found out that we're getting a new office"
  │
  ├─ Round 1: 😊 Excited American     → "I just found out..."  (excited, fast, loud)
  ├─ Round 2: 🇬🇧 Sarcastic Brit      → "I just found out..."  (sarcastic, measured, british)
  ├─ Round 3: 😰 Anxious Whisperer    → "I just found out..."  (anxious, whispering, hesitant)
  ├─ Round 4: 😤 Angry New Yorker     → "I just found out..."  (angry, shouting, fast, new york)
  └─ Round 5: 🧘 Calm Storyteller     → "I just found out..."  (calm, soft, melodic)
  │
  └─ Combined: All 5 back-to-back with 0.5s pauses
```

## Try It

```bash
export SMALLEST_API_KEY="your-key"

# Default characters and text
python whispers.py

# Custom text
python whispers.py "The quarterly earnings report is absolutely devastating"

# Custom characters file
python whispers.py --characters my_characters.json "Hello world"
```

## Custom Characters

Create a JSON file with your own character lineup:

```json
[
  {"name": "Pirate Captain", "emotion": "excited", "accent": "irish", "volume": "loud", "prosody": "melodic"},
  {"name": "Robot", "emotion": "neutral", "accent": "general american", "volume": "normal", "prosody": "monotonous"},
  {"name": "Grandma", "emotion": "empathetic", "accent": "southern american", "volume": "soft", "prosody": "slow"}
]
```

## Output

Generates individual WAV files per character + a combined file:

```
output/
├── 1_excited_american.wav
├── 2_sarcastic_brit.wav
├── 3_anxious_whisperer.wav
├── 4_angry_new_yorker.wav
├── 5_calm_storyteller.wav
└── chinese_whispers_combined.wav    ← all rounds back-to-back
```

## What's Next?

| Want to… | Go to |
|----------|-------|
| Control emotions manually | [Expressive TTS](../expressive-tts/) |
| Auto-detect emotions from text | [Expressive TTS — LLM mode](../expressive-tts/) |
| Browse all voices | [Voices](../voices/) |
