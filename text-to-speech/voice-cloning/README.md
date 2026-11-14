# Voice Cloning

Clone any voice from a short audio sample (5-15 seconds) and use it for text-to-speech synthesis.

## Instant Clone

Upload a short clip, get a usable voice ID back:

```python
from smallestai import SmallestAI

client = SmallestAI()  # reads SMALLEST_API_KEY from the environment

with open("sample.wav", "rb") as f:
    res = client.waves.create_voice_clone(
        display_name="My Custom Voice",
        file=("sample.wav", f, "audio/wav"),
    )
voice_id = res.data.voice_id
print(f"Voice ID: {voice_id}")
```

Pass the file as a `(filename, file_object, content_type)` tuple so the upload carries the right file type.

## Clone and Speak

Use the new voice ID like any catalog voice on the unified TTS endpoint:

```python
audio = b"".join(client.waves.synthesize_tts(
    text="Hello from my cloned voice!",
    voice_id=voice_id,
    model="lightning_v3.1",
    sample_rate=24000,
))
```

## List Cloned Voices

```python
for clone in client.waves.list_voice_clones().data:
    print(clone.voice_id, clone.display_name, clone.status)
```

## REST equivalents

```bash
# Create
curl -X POST "https://api.smallest.ai/waves/v1/voice-cloning" \
  -H "Authorization: Bearer $SMALLEST_API_KEY" \
  -F "displayName=My Custom Voice" \
  -F "file=@sample.wav"

# List
curl "https://api.smallest.ai/waves/v1/voice-cloning" \
  -H "Authorization: Bearer $SMALLEST_API_KEY"
```

## API Reference

- [Voice Cloning guide](https://docs.smallest.ai/waves/documentation/voice-cloning/how-to-vc)
