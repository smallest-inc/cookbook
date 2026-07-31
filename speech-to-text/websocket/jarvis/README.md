# Jarvis Voice Assistant

A background AI assistant powered by Smallest AI that can understand what's on your screen through screenshots.

Say "Jarvis" followed by your question to get a spoken response. Mention "screenshot" in your query, and Jarvis will prompt you to capture part of your screen for visual context.

## Demo


https://github.com/user-attachments/assets/81abd57c-f4a1-4922-86c8-8514a13845d0


## Features

- **Wake Word Activation**: Triggered by saying "Jarvis"
- **Screenshot Analysis**: Say "screenshot" to capture and analyze part of your screen
- **Conversation Memory**: Stores previous context for follow-up questions
- **Voice Response**: Speaks responses aloud via TTS

## Pipeline

```
Microphone → Pulse STT (WebSocket) → Wake Word → [Screenshot?] → Vision + LLM → TTS (HTTP) → Speaker
```

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../../README.md#usage) for setup.

Add `SMALLEST_API_KEY` and `GROQ_API_KEY` to your `.env`.

Extra dependencies:

```bash
uv pip install -r requirements.txt
```

This installs `pyaudio` and `httpx` (groq is already in the root install).

## Usage

```bash
uv run jarvis.py
```

## Recommended Usage

- Starting point for building always-on voice assistants with wake word detection, vision, and speech output
- Local desktop assistant combining STT, LLM, and TTS
- For deployed telephony agents, the [Voice Agents](../../../voice-agents/) examples are recommended

## How It Works

1. **Continuous Listening**: Microphone audio streams to Pulse STT via WebSocket
2. **Wake Word Detection**: Listens for "Jarvis" in transcriptions
3. **Query Capture**: Collects speech until 5 seconds of silence
4. **Screenshot (Optional)**: If query contains "screenshot":
   - Opens native screenshot tool (flameshot/scrot/etc.)
   - Select the region you want to capture
   - Press Enter or click to confirm
   - Vision model extracts text and describes the image
5. **LLM Response**: Query + image context sent to Groq (Llama 3.3 70B)
6. **TTS Playback**: Response spoken via Lightning TTS (HTTP POST)
7. **Follow-up**: Stays in conversation mode for 60 seconds

## Project Structure

```
speech-to-text/websocket/jarvis/
├── .env.sample          # Environment variables template
├── README.md
├── jarvis.py        # Main assistant (wake word, state machine)
├── stt.py           # Pulse STT WebSocket client + mic capture
├── llm.py           # Groq LLM + vision with screenshot support
├── tts.py           # Lightning TTS HTTP client
└── requirements.txt
```

## Configuration

| File | Variable | Default | Description |
|------|----------|---------|-------------|
| `jarvis.py` | `WAKE_WORD` | `"jarvis"` | Trigger phrase (case-insensitive) |
| `jarvis.py` | `SILENCE_TIMEOUT` | `5.0` | Seconds of silence to end query |
| `jarvis.py` | `CONVERSATION_TIMEOUT` | `60.0` | Seconds before returning to wake word mode |
| `tts.py` | `TTS_VOICE` | `"sophia"` | Lightning TTS voice ID |
| `llm.py` | `LLM_MODEL` | `"llama-3.3-70b-versatile"` | Text model |
| `llm.py` | `LLM_VISION_MODEL` | `"meta-llama/llama-4-scout-17b-16e-instruct"` | Vision model for screenshots |

## Further Scope

This example is intentionally kept simple to serve as a starting point for building voice assistants. Here are some ideas for extending it:

### Tool Calling
- **Web Search**: Integrate search APIs to answer questions about current events
- **Calendar/Email**: Connect to productivity APIs for scheduling and messaging
- **Smart Home**: Control IoT devices with voice commands
- **Code Execution**: Run Python snippets for calculations or data analysis

### TTS Streaming
The TTS implementation uses HTTP POST intentionally, returning the complete audio before playback. For lower latency, you can upgrade to the [Lightning TTS WebSocket API](https://waves-docs.smallest.ai/content/api-references/lightning-v3.1-ws) which streams audio chunks as they're generated. This is left as an exercise to help developers understand the difference between batch and streaming approaches when building voice assistants.

### Other Improvements
- Add interrupt handling (stop speaking when user starts talking)
- Implement wake word detection locally for privacy
- Add multi-language support
- Build a GUI with waveform visualization

## API Reference

- [Pulse STT WebSocket](https://waves-docs.smallest.ai/content/api-references/pulse-stt-ws)
- [Lightning TTS HTTP](https://waves-docs.smallest.ai/content/api-references/lightning-v3.1)
- [Lightning TTS WebSocket](https://waves-docs.smallest.ai/content/api-references/lightning-v3.1-ws)
- [Groq API](https://console.groq.com/docs/api-reference)

## Next Steps

- [Voice Agents](../../../voice-agents/) — Build deployed telephony agents with the Voice Agents SDK
- [Realtime Microphone](../realtime-microphone-transcription/) — Simpler Gradio UI for live transcription
