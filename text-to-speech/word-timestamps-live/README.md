# Live Word Timestamps

WebSocket TTS with per-word timing. While the audio streams in, the server also sends a timestamp frame for every word, so you can build live captions, karaoke-style highlighting, or word-level alignment without a separate forced aligner.

## Try It

```bash
uv run python/word_timestamps.py "Word timestamps make live captions easy."
```

Output:

```
[  0.00s -   0.32s] Word
[  0.32s -   0.78s] timestamps
[  0.78s -   1.05s] make
[  1.05s -   1.38s] live
[  1.38s -   1.82s] captions
[  1.82s -   2.20s] easy.

6 words, 4 audio chunks
Saved to out.wav
```

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. This example also needs `websockets>=14` (for the `additional_headers` argument), so install the local file too:
>
> ```bash
> uv pip install -r requirements.txt
> ```
>
> Add `SMALLEST_API_KEY` to your `.env` (see `.env.sample`).

## How It Works

1. Connect to `wss://api.smallest.ai/waves/v1/tts/live` with an `Authorization: Bearer <SMALLEST_API_KEY>` header.
2. Send one JSON payload with `"word_timestamps": true`, then `{"flush": true}`:

   ```json
   {
     "text": "Word timestamps make live captions easy.",
     "voice_id": "kaitlyn",
     "model": "lightning_v3.1_pro",
     "sample_rate": 24000,
     "word_timestamps": true
   }
   ```

3. The server interleaves three frame types, discriminated by `status`:

   | `status` | Payload |
   |----------|---------|
   | `chunk` | `data.audio`, base64 PCM16 audio |
   | `word_timestamp` | Word timing objects `{id, word, start, end}` (times in seconds) |
   | `complete` | Synthesis finished |

   An `error` frame carries the failure detail; the script prints it and exits nonzero.

4. The script prints a caption line per word as timestamps arrive, joins the PCM chunks, and wraps them with Python's `wave` module into `out.wav` (24 kHz, mono, 16-bit).

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `MODEL` | TTS model | `lightning_v3.1_pro` |
| `VOICE_ID` | Voice to use | `kaitlyn` |
| `SAMPLE_RATE` | Audio sample rate in Hz | `24000` |
| `word_timestamps` | Enable per-word timing frames | `true` |

## API Reference

- [TTS WebSocket API](https://docs.smallest.ai/api-reference/models/text-to-speech/tts)
- [Word timestamps guide](https://docs.smallest.ai/models/text-to-speech/word-timestamps)

## Next Steps

- [Streaming](../streaming/): SSE and WebSocket streaming without timestamps
- [Word-Level Outputs (STT)](../../speech-to-text/word-level-outputs/): word timestamps for transcription instead of synthesis
