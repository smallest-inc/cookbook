"""FastAPI backend for Langly translation app."""
import asyncio
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import SOURCE_LANGUAGES, TARGET_LANGUAGES, SPEECH_LANGUAGES
from .translator import translate_text
from .tts import synthesize_speech
from .stt import transcribe_audio, close_stt_client
from .tts import get_voices
from .database import init_db, add_to_history, get_history, delete_history_item


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_stt_client()


app = FastAPI(title="Langly", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Schemas ---


class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_langs: List[str]


class TranslateResponse(BaseModel):
    translations: dict  # target_lang -> translated_text


class TTSRequest(BaseModel):
    text: str
    language: str = "auto"
    voice_id: str | None = None


class HistoryItem(BaseModel):
    id: int
    source_text: str
    source_lang: str
    target_lang: str
    translated_text: str
    created_at: str


# --- Routes ---


@app.get("/api/voices")
async def list_voices(language: str = "en"):
    """Get available TTS voices for the given target language. v3.1 for en/hi/ta/es, v2 for others."""
    voices = get_voices(language)
    return {"voices": voices}


@app.get("/api/languages")
async def list_languages():
    """Get source, target, and speech-input languages."""
    return {
        "source_languages": SOURCE_LANGUAGES,
        "target_languages": TARGET_LANGUAGES,
        "speech_languages": SPEECH_LANGUAGES,
    }


@app.post("/api/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """Translate text to one or more target languages."""
    if not req.text.strip():
        raise HTTPException(400, "Text is required")
    if req.source_lang not in SOURCE_LANGUAGES:
        raise HTTPException(400, f"Unsupported source language: {req.source_lang}")

    translations = {}
    loop = asyncio.get_event_loop()
    for target in req.target_langs:
        if target not in TARGET_LANGUAGES:
            raise HTTPException(400, f"Unsupported target language: {target}")
        result = await loop.run_in_executor(
            None, translate_text, req.text, req.source_lang, target
        )
        if result is None:
            raise HTTPException(500, f"Translation failed for {target}")
        translations[target] = result
        await add_to_history(req.text, req.source_lang, target, result)

    return TranslateResponse(translations=translations)


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """Generate speech from text. Returns WAV audio."""
    if not req.text.strip():
        raise HTTPException(400, "Text is required")

    loop = asyncio.get_event_loop()
    try:
        audio = await loop.run_in_executor(
            None,
            lambda: synthesize_speech(
                text=req.text,
                language=req.language if req.language != "auto" else "auto",
                voice_id=req.voice_id,
            ),
        )
        if audio is None:
            raise HTTPException(500, "TTS generation failed")
        return Response(
            content=audio,
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"},
        )
    except ValueError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/stt")
async def speech_to_text(
    language: str = "en",
    file: UploadFile = File(..., description="Audio file (WAV)"),
):
    """Transcribe audio to text using Pulse STT. Only Pulse-compatible languages."""
    if language not in SPEECH_LANGUAGES:
        raise HTTPException(
            400,
            f"Speech input not supported for '{language}'. Use one of: {', '.join(SPEECH_LANGUAGES.keys())}",
        )
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(400, "Empty audio file")
        content_type = file.content_type or (
            "audio/webm" if (file.filename or "").endswith(".webm") else "audio/wav"
        )
        text, duration_seconds = await transcribe_audio(audio_bytes, language, content_type)
        return {"transcription": text or "", "duration_seconds": round(duration_seconds, 2)}
    except ValueError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/history")
async def history(limit: int = 10):
    """Get translation history (last 10 by default)."""
    items = await get_history(limit=limit)
    return {"history": items}


@app.delete("/api/history/{item_id}")
async def delete_history(item_id: int):
    """Delete a history item."""
    ok = await delete_history_item(item_id)
    if not ok:
        raise HTTPException(404, "History item not found")
    return {"ok": True}
