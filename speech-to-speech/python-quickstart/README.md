# Python Quickstart (Hydra)

Minimal headless Hydra client. Streams a WAV file to the realtime speech-to-speech endpoint as if it were live microphone audio, prints the assistant's transcript as it streams, and saves the spoken reply to `reply.wav`.

## Try It

```bash
uv run quickstart.py path/to/audio.wav
```

Output:

```
Streaming 3.2s of audio...
[speech started]
[speech stopped]
Sure, I can help with that. What would you like to know?
Saved reply to reply.wav
```

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` to your `.env` (see `.env.sample`).

Input must be a 16-bit PCM WAV. Any sample rate and channel count works; the script downmixes to mono and naively resamples to 16 kHz.

## How It Works

1. Connect to:

   ```
   wss://api.smallest.ai/waves/v1/s2s?model=hydra&api_key=<SMALLEST_API_KEY>
   ```

2. Configure the session:

   ```json
   {
     "type": "session.configure",
     "session": {
       "instructions": "You are a helpful voice assistant...",
       "voice": "wren",
       "input_audio_sample_rate": 16000,
       "output_audio_sample_rate": 16000
     }
   }
   ```

3. Stream the file's PCM16 as `{"type": "input_audio_buffer.append", "audio": "<base64>"}` chunks of 100 ms, paced at real time, followed by about 1.2 s of silence chunks so the server-side VAD detects end of speech and closes the turn.

4. Read events concurrently while sending:

   | Event | Meaning |
   |-------|---------|
   | `input_audio_buffer.speech_started` / `speech_stopped` | Server VAD detected your speech |
   | `response.output_audio.delta` | Base64 PCM16 reply audio (collected) |
   | `response.output_audio_transcript.delta` | Reply transcript text (printed live) |
   | `response.done` | Turn finished, stop reading |

5. The collected reply audio is saved to `reply.wav` (16 kHz, mono, 16-bit).

## Pacing Matters

Hydra expects a live audio stream. The script sends one 100 ms chunk every 100 ms of wall-clock time. Dumping the entire file at once gets the socket closed by the server with a "session ended" message, so keep the pacing if you adapt this script.

## API Reference

- [Hydra overview and event reference](https://docs.smallest.ai/waves/documentation/speech-to-speech-hydra/overview)
- [Waves API Reference](https://docs.smallest.ai/waves/api-reference)

## Next Steps

- [Hydra Realtime Demo](../hydra-realtime-demo/): full browser client with live microphone, agent presets, and tool calling
