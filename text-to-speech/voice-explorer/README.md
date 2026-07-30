# Voice Explorer

Interactive browser for all Smallest AI voices. Type preview text, pick a model, search by use case or emotion, and hit **Play** to hear any voice instantly.

## Features

- **Semantic search** — find voices by use case, emotion, or attribute (e.g. "calm meditation", "news anchor", "warm storytelling", "British female")
- **Inline audio playback** — generated audio plays directly in the card; results are cached so replaying is instant
- **Cloned voice section** — your custom cloned voices appear in a separate section automatically
- Model selector switches between **Lightning v3.1** and **Lightning v3.1 Pro** without losing your search or text

## Requirements

```bash
# From the repo root
uv pip install -r requirements.txt

# Extra dependencies for this example
uv pip install -r text-to-speech/voice-explorer/requirements.txt
```

Copy `.env.sample` to `.env` and add your key:

```env
SMALLEST_API_KEY=your-smallest-api-key-here
```

## Usage

```bash
python app.py
# or
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501) in your browser.

> **Note:** The first run will be slower — the semantic search model (`BAAI/bge-small-en-v1.5`, ~50 MB) is downloaded automatically on startup. Subsequent runs use the cached model and start instantly.

## How Semantic Search Works

Voices are embedded at startup using [`fastembed`](https://github.com/qdrant/fastembed) with `BAAI/bge-small-en-v1.5` (~50 MB total, ONNX runtime — no PyTorch). Each voice is represented as a text description combining its name, gender, age, accent, language, emotions, and use cases:

```
"Leon male young german emotions: Confident Engaging usecases: ads learning"
```

When you type a search query, it's embedded with the same model and ranked by cosine similarity. This handles natural language queries that don't exactly match metadata labels.

## API Reference

- [Get Voices](https://waves-docs.smallest.ai/v4.0.0/content/api-references/get-voices-api)
- [Get Cloned Voices](https://waves-docs.smallest.ai/v4.0.0/content/api-references/get-cloned-voices-api)
- [Text-to-Speech](https://waves-docs.smallest.ai/v4.0.0/content/api-references/tts-api)
