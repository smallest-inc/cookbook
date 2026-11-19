# Python Quickstart (Hydra)

Minimal headless Hydra client. Streams a WAV file to the realtime speech-to-speech endpoint as if it were live microphone audio, prints the assistant's transcript as it streams, and saves the spoken reply to `reply.wav`.

## Try It

```bash
uv pip install -r requirements.txt
uv run quickstart.py path/to/audio.wav
```

Output (asking "What is the capital of France?"):

```
Streaming 2.6s of audio...
[speech started]
[speech stopped]
Oh, that's easy. The capital of France is Paris.
Saved reply to reply.wav
```

> **Known issue (Nov 2026):** the endpoint currently returns the reply transcript but no `response.output_audio.delta` frames, so the script prints `No reply audio received` instead of saving `reply.wav`. The transcript part works. This README will be updated when audio frames are back.

## Requirements

> Install `requirements.txt` in this folder (it needs `websockets>=14` for the `additional_headers` argument). See the [main README](../../README.md#usage) for the shared setup. Add `SMALLEST_API_KEY` to your `.env` (see `.env.sample`).

Input must be a 16-bit PCM WAV. Any sample rate and channel count works; the script downmixes to mono and naively resamples to 16 kHz.

## How It Works

1. Connect to the endpoint with your key in the `Authorization` header:

   ```
   wss://api.smallest.ai/waves/v1/s2s?model=hydra-v1.0
   Authorization: Bearer <SMALLEST_API_KEY>
   ```

   `model=hydra` still works but the server warns that it is deprecated, so use `hydra-v1.0`. The endpoint also accepts the key as an `api_key` query parameter, which is the only option in a browser because browsers cannot set WebSocket headers. A URL can end up in logs, so from a server or script prefer the header, and never ship your API key to a browser.

2. Wait for the server's `session.created` event. A `session.configure` sent before it is dropped and the session never gets configured.

3. Configure the session:

   ```json
   {
     "type": "session.configure",
     "session": {
       "instructions": "You are a helpful voice assistant...",
       "voice": "aria",
       "input_audio_sample_rate": 16000,
       "output_audio_sample_rate": 16000
     }
   }
   ```

   Wait for `session.configured` before sending audio. Valid voices include `aria`, `maya`, `marin`, `sterling`, `kai` and `zoe`.

4. Stream the file's PCM16 as `{"type": "input_audio_buffer.append", "audio": "<base64>"}` chunks of 100 ms, paced at real time, followed by about 1.2 s of silence chunks so the server-side VAD detects end of speech and closes the turn.

5. Read events concurrently while sending:

   | Event | Meaning |
   |-------|---------|
   | `input_audio_buffer.speech_started` / `speech_stopped` | Server VAD detected your speech |
   | `response.output_audio.delta` | Base64 PCM16 reply audio (collected) |
   | `response.output_audio_transcript.delta` | Reply transcript text (printed live) |
   | `response.done` | Turn finished, stop reading |

6. The collected reply audio is saved to `reply.wav` (16 kHz, mono, 16-bit). The whole turn has a 60 second timeout (`TURN_TIMEOUT_S`), so the script exits even if the server never sends `response.done`.

## Pacing Matters

Hydra expects a live audio stream. The script sends one 100 ms chunk every 100 ms of wall-clock time. Dumping the entire file at once gets the socket closed by the server with a "session ended" message, so keep the pacing if you adapt this script.

## API Reference

- [Hydra overview and event reference](https://docs.smallest.ai/waves/documentation/speech-to-speech-hydra/overview)
- [Waves API Reference](https://docs.smallest.ai/waves/api-reference)

## Next Steps

- [Hydra Realtime Demo](../hydra-realtime-demo/): full browser client with live microphone, agent presets, and tool calling
