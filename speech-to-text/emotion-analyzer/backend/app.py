#!/usr/bin/env python3
"""
Emotion Analyzer — Smallest AI Pulse STT

Upload audio → diarize speakers → detect emotions per segment → visualize.

Usage:
    uv run backend/app.py

Opens a web UI at http://localhost:5000.
"""

import os
import io
import logging
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify, send_from_directory
from pydub import AudioSegment
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="../frontend", static_url_path="")

API_URL = "https://api.smallest.ai/waves/v1/stt/"
API_KEY = os.environ.get("SMALLEST_API_KEY", "")
MAX_WORKERS = 10


def transcribe_with_diarization(audio_bytes: bytes) -> dict:
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/octet-stream"}
    params = {"model": "pulse", "language": "en", "diarize": "true", "word_timestamps": "true"}
    logger.info("Transcribing audio (%d bytes)...", len(audio_bytes))
    resp = requests.post(API_URL, headers=headers, params=params, data=audio_bytes, timeout=600)
    resp.raise_for_status()
    result = resp.json()
    logger.info("Transcription done — %d utterances", len(result.get("utterances", [])))
    return result


def detect_emotions_for_segment(segment_bytes: bytes) -> dict:
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/octet-stream"}
    params = {"model": "pulse", "language": "en", "emotion_detection": "true"}
    resp = requests.post(API_URL, headers=headers, params=params, data=segment_bytes, timeout=300)
    resp.raise_for_status()
    return resp.json()


def split_audio_segment(audio: AudioSegment, start_sec: float, end_sec: float) -> bytes:
    segment = audio[int(start_sec * 1000):int(end_sec * 1000)]
    buf = io.BytesIO()
    segment.export(buf, format="wav")
    return buf.getvalue()


def process_utterance(idx: int, total: int, utt: dict, audio: AudioSegment) -> dict:
    speaker = utt.get("speaker", "unknown")
    start = utt.get("start", 0)
    end = utt.get("end", 0)
    text = utt.get("text", "")

    if (end - start) < 0.5:
        logger.info("[%d/%d] %s %.1fs–%.1fs skipped (too short)", idx + 1, total, speaker, start, end)
        return {"index": idx, "speaker": speaker, "start": start, "end": end, "text": text, "emotions": None, "skipped": True}

    try:
        seg_bytes = split_audio_segment(audio, start, end)
        emotions = detect_emotions_for_segment(seg_bytes).get("emotions", {})
        top = max(emotions, key=emotions.get) if emotions else "none"
        logger.info("[%d/%d] %s %.1fs–%.1fs → %s (%.2f)", idx + 1, total, speaker, start, end, top, emotions.get(top, 0))
    except Exception as e:
        logger.warning("[%d/%d] %s %.1fs–%.1fs failed: %s", idx + 1, total, speaker, start, end, e)
        emotions = None

    return {"index": idx, "speaker": speaker, "start": start, "end": end, "text": text, "emotions": emotions, "skipped": False}


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    if not API_KEY:
        return jsonify({"error": "SMALLEST_API_KEY not set"}), 500

    file = request.files.get("audio")
    if not file:
        return jsonify({"error": "No audio file provided"}), 400

    audio_bytes = file.read()
    logger.info("Received: %s (%.2f MB)", file.filename, len(audio_bytes) / 1024 / 1024)

    # Step 1: Diarized transcription
    try:
        diarized = transcribe_with_diarization(audio_bytes)
    except requests.RequestException as e:
        logger.error("Transcription failed: %s", e)
        return jsonify({"error": f"Transcription failed: {e}"}), 502

    utterances = diarized.get("utterances", [])
    if not utterances:
        return jsonify({"error": "No utterances found — audio may be too short or silent."}), 400

    # Merge utterances sharing the same (start, end, speaker)
    merged, prev_key = [], None
    for utt in utterances:
        key = (utt.get("start"), utt.get("end"), utt.get("speaker"))
        if merged and key == prev_key:
            merged[-1]["text"] += utt.get("text", "")
        else:
            merged.append({
                "start": utt.get("start", 0),
                "end": utt.get("end", 0),
                "speaker": f"Speaker {utt.get('speaker', '?')}",
                "text": utt.get("text", ""),
            })
            prev_key = key

    logger.info("Merged %d utterances → %d segments", len(utterances), len(merged))
    utterances = merged

    # Load audio for splitting
    try:
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        logger.info("Audio: %.1fs, %d channels, %d Hz", len(audio) / 1000, audio.channels, audio.frame_rate)
    except Exception as e:
        logger.error("Audio decode failed: %s", e)
        return jsonify({"error": f"Could not decode audio: {e}"}), 400

    # Step 2: Concurrent emotion detection
    total = len(utterances)
    logger.info("Running emotion detection on %d segments (%d workers)...", total, MAX_WORKERS)

    results = [None] * total
    speakers_seen = set()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for i, utt in enumerate(utterances):
            speakers_seen.add(utt.get("speaker", "unknown"))
            futures[executor.submit(process_utterance, i, total, utt, audio)] = i

        done = 0
        for future in as_completed(futures):
            results[future.result()["index"]] = future.result()
            done += 1
            if done % 5 == 0 or done == total:
                logger.info("Progress: %d/%d", done, total)

    for r in results:
        r.pop("index", None)

    logger.info("Done — %d segments, %d speakers", len(results), len(speakers_seen))

    return jsonify({
        "transcription": diarized.get("transcription", ""),
        "speakers": sorted(speakers_seen),
        "segments": results,
    })


if __name__ == "__main__":
    if not API_KEY:
        logger.warning("SMALLEST_API_KEY not set — export SMALLEST_API_KEY=your-key")
    else:
        logger.info("API key loaded (...%s)", API_KEY[-4:])
    logger.info("Starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
