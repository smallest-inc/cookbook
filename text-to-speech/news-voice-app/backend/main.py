import asyncio
import base64
import json
import os
import re
import struct
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from ai import group_articles, summarize_group
from rss import fetch_articles

load_dotenv()

SMALLEST_API_KEY = os.getenv("SMALLEST_API_KEY")
OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY")

STREAM_URL  = "https://api.smallest.ai/waves/v1/tts/live"
VOICE_ID    = "olivia"
SAMPLE_RATE = 24000

DATA_DIR     = Path(__file__).parent.parent / "data"
INDEX_FILE   = DATA_DIR / "index.json"
ARTICLES_DIR = DATA_DIR / "articles"
GROUPS_DIR   = DATA_DIR / "groups"
AUDIO_DIR    = DATA_DIR / "audio"


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------


def _load_index() -> dict:
    if INDEX_FILE.exists():
        return json.loads(INDEX_FILE.read_text())
    return {"synced_at": None, "articles": [], "groups": []}


def _save_index(index: dict) -> None:
    tmp = INDEX_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(index, indent=2))
    os.replace(tmp, INDEX_FILE)


def _load_article(article_id: str) -> dict | None:
    path = ARTICLES_DIR / f"{article_id}.json"
    return json.loads(path.read_text()) if path.exists() else None


def _save_article(article: dict) -> None:
    path = ARTICLES_DIR / f"{article['id']}.json"
    path.write_text(json.dumps(article, indent=2))


def _save_group(group: dict) -> None:
    path = GROUPS_DIR / f"{group['id']}.json"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(group, indent=2))
    os.replace(tmp, path)


def _load_group(group_id: str) -> dict | None:
    path = GROUPS_DIR / f"{group_id}.json"
    return json.loads(path.read_text()) if path.exists() else None


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48]


# ---------------------------------------------------------------------------
# TTS helpers
# ---------------------------------------------------------------------------


def _generate_pcm(text: str) -> bytes:
    resp = requests.post(
        STREAM_URL,
        headers={
            "Authorization": f"Bearer {SMALLEST_API_KEY}",
            "Content-Type":  "application/json",
        },
        json={
            "text":          text,
            "voice_id":      VOICE_ID,
            "model":         "lightning_v3.1",
            "sample_rate":   SAMPLE_RATE,
            "speed":         1.0,
            "output_format": "pcm",
        },
        stream=True,
        timeout=120,
    )
    resp.raise_for_status()

    pcm_parts = []
    for line in resp.iter_lines():
        if not line or not line.startswith(b"data:"):
            continue
        data = line[5:].strip()
        if not data or data == b"[DONE]":
            continue
        try:
            audio_b64 = json.loads(data).get("audio", "")
        except (json.JSONDecodeError, ValueError):
            audio_b64 = data.decode()
        audio_b64 += "=" * (-len(audio_b64) % 4)
        pcm_parts.append(base64.b64decode(audio_b64))
    return b"".join(pcm_parts)


def _pcm_to_wav(pcm: bytes) -> bytes:
    num_channels    = 1
    bits_per_sample = 16
    byte_rate       = SAMPLE_RATE * num_channels * bits_per_sample // 8
    block_align     = num_channels * bits_per_sample // 8
    data_size       = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, num_channels,
        SAMPLE_RATE, byte_rate, block_align, bits_per_sample,
        b"data", data_size,
    )
    return header + pcm


# ---------------------------------------------------------------------------
# Sync worker
# ---------------------------------------------------------------------------


def sync() -> None:
    print(f"[sync] Starting at {datetime.now(timezone.utc).isoformat()}")
    for d in (DATA_DIR, ARTICLES_DIR, GROUPS_DIR, AUDIO_DIR):
        d.mkdir(exist_ok=True)

    index  = _load_index()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    # 1. Prune expired articles
    live_articles = []
    for a in index.get("articles", []):
        fetched = datetime.fromisoformat(a["fetched_at"])
        if fetched < cutoff:
            (ARTICLES_DIR / f"{a['id']}.json").unlink(missing_ok=True)
            print(f"[sync] Pruned article: {a['id']}")
        else:
            live_articles.append(a)

    # 2. Fetch new articles
    known_urls   = {a["url"] for a in live_articles}
    new_articles = fetch_articles(known_urls)
    for article in new_articles:
        _save_article(article)
        live_articles.append({
            "id":         article["id"],
            "url":        article["url"],
            "source":     article["source"],
            "fetched_at": article["fetched_at"],
            "group_id":   None,
        })
    print(f"[sync] {len(new_articles)} new articles, {len(live_articles)} total")

    if not live_articles:
        print("[sync] No articles, skipping grouping")
        return

    # 3. Load full article data for grouping
    full_articles = [_load_article(a["id"]) for a in live_articles]
    full_articles = [a for a in full_articles if a]
    article_by_id = {a["id"]: a for a in full_articles}

    # 4. Group articles via OpenAI
    groups_raw = group_articles(full_articles, OPENAI_API_KEY)
    print(f"[sync] {len(groups_raw)} groups")

    new_group_ids       = set()
    group_index_entries = []

    for g in groups_raw:
        slug                = _slugify(g["name"])
        group_articles_data = [article_by_id[aid] for aid in g["article_ids"] if aid in article_by_id]
        if not group_articles_data:
            continue

        existing = _load_group(slug)
        old_ids  = set(existing["article_ids"]) if existing else set()
        new_ids  = set(g["article_ids"])
        changed  = old_ids != new_ids

        # 5. Summarize only if group is new or its articles changed
        if existing and not changed:
            summary = existing["summary"]
            print(f"[sync] Unchanged: {g['name']}")
        else:
            print(f"[sync] Summarizing: {g['name']}")
            summary = summarize_group(g["name"], group_articles_data, OPENAI_API_KEY)

        image_url  = next((a.get("image_url") for a in group_articles_data if a.get("image_url")), None)
        updated_at = existing["updated_at"] if (existing and not changed) else datetime.now(timezone.utc).isoformat()

        group_data = {
            "id":          slug,
            "name":        g["name"],
            "summary":     summary,
            "image_url":   image_url,
            "updated_at":  updated_at,
            "article_ids": g["article_ids"],
        }
        _save_group(group_data)

        # 6. Generate and store audio — skip if WAV already exists and group is unchanged
        audio_path = AUDIO_DIR / f"{slug}.wav"
        if not audio_path.exists() or changed:
            print(f"[sync] Generating audio: {g['name']}")
            try:
                pcm = _generate_pcm(summary)
                tmp = audio_path.with_suffix(".tmp")
                tmp.write_bytes(_pcm_to_wav(pcm))
                os.replace(tmp, audio_path)
                print(f"[sync] Audio saved: {audio_path.name} ({len(pcm) / (SAMPLE_RATE * 2):.1f}s)")
            except Exception as e:
                print(f"[sync] Audio generation failed for {slug}: {e}")
        else:
            print(f"[sync] Audio cached: {g['name']}")

        new_group_ids.add(slug)
        group_index_entries.append({"id": slug, "name": g["name"], "updated_at": updated_at})

        for a in live_articles:
            if a["id"] in new_ids:
                a["group_id"] = slug

    # 7. Delete stale group and audio files
    for path in GROUPS_DIR.glob("*.json"):
        if path.stem not in new_group_ids:
            path.unlink()
    for path in AUDIO_DIR.glob("*.wav"):
        if path.stem not in new_group_ids:
            path.unlink()
            print(f"[sync] Deleted stale audio: {path.name}")

    # 8. Rewrite index
    index["synced_at"] = datetime.now(timezone.utc).isoformat()
    index["articles"]  = live_articles
    index["groups"]    = group_index_entries
    _save_index(index)
    print("[sync] Done")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(sync, "interval", minutes=30, next_run_time=datetime.now())
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/news")
def get_news() -> list[dict]:
    index  = _load_index()
    result = []
    for g in index.get("groups", []):
        group = _load_group(g["id"])
        if not group:
            continue
        articles = []
        for aid in group.get("article_ids", []):
            a = _load_article(aid)
            if a:
                articles.append({"title": a["title"], "url": a["url"], "source": a["source"]})
        result.append({
            "id":          group["id"],
            "name":        group["name"],
            "summary":     group["summary"],
            "image_url":   group["image_url"],
            "updated_at":  group["updated_at"],
            "audio_ready": (AUDIO_DIR / f"{group['id']}.wav").exists(),
            "articles":    articles,
        })
    return result


@app.get("/audio/{group_id}")
def get_audio(group_id: str) -> FileResponse:
    path = AUDIO_DIR / f"{group_id}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not ready yet")
    return FileResponse(path, media_type="audio/wav")


@app.post("/refresh")
async def trigger_refresh() -> dict:
    """Run a full sync immediately and return when done."""
    await asyncio.get_event_loop().run_in_executor(None, sync)
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
