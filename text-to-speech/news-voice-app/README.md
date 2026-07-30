# News Voice UI

A web dashboard that groups today's top headlines into major story clusters and plays each as a 2-3 minute audio summary.

## Features

- Polls BBC World, NPR, Guardian, and Al Jazeera every 30 minutes via RSS
- Groups articles into major events using GPT-4o-mini
- Generates a 2-3 minute broadcast script per group, stored as individual JSON files
- Only re-summarizes groups whose article set has changed since the last sync
- Prunes articles older than 24 hours automatically
- Card grid UI with images sourced from RSS feeds
- Click a card to play its audio summary; click again to stop; clicking another card switches
- Expand button opens a modal with the full summary text and source article links

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../README.md#usage) for setup. Add `SMALLEST_API_KEY` and `OPENAI_API_KEY` to your `.env`.

**Backend**

```bash
cd backend
uv pip install -r requirements.txt
```

**Frontend**

```bash
cd frontend
npm install
```

## Usage

```bash
# Terminal 1 — backend (runs on :8000, syncs news on startup)
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2 — frontend (runs on :3000)
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Cards appear once the first sync completes (a few seconds after the backend starts).

## How It Works

1. On startup the backend runs a sync immediately, then every 30 minutes via APScheduler.
2. Sync loads `data/index.json`, deletes article files older than 24 hours, then fetches fresh RSS from all four feeds.
3. New articles are written as individual files under `data/articles/{id}.json` and added to the index.
4. All current article titles are sent to GPT-4o-mini, which returns a JSON grouping of indices into major story clusters.
5. For each group whose article set has changed, GPT-4o-mini writes a 2-3 minute broadcast script saved to `data/groups/{slug}.json`.
6. `GET /news` reads the index and group files and returns the full card data to the frontend.
7. Clicking a card POSTs the stored summary text to `POST /audio`, which streams audio from Smallest AI TTS and returns a WAV file for immediate playback.

## File Structure

```
news-voice-app/
├── .env.sample
├── backend/
│   ├── main.py          # FastAPI app + APScheduler + /news and /audio endpoints
│   ├── rss.py           # RSS fetching via feedparser
│   ├── ai.py            # OpenAI grouping and summarization
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   └── app/
│       ├── layout.tsx
│       └── page.tsx     # Card grid, modal, and audio playback logic
└── data/                # Created at runtime, gitignored
    ├── index.json
    ├── articles/
    └── groups/
```

## API Reference

- [Waves TTS Overview](https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech/overview)
- [TTS streaming endpoint](https://docs.smallest.ai/models/api-reference/text-to-speech/synthesize-speech-sse)

## Next Steps

- [News Voice App](../news-voice-app/) — CLI version of the same concept (Python only)
- [Voice Explorer](../voice-explorer/) — Browse and preview all available voices
