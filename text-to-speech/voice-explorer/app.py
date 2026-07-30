#!/usr/bin/env python3
"""Voice Explorer -- Preview all Smallest AI voices with semantic search."""

import base64
import hashlib
import io
import os
import wave

import numpy as np
import requests
import streamlit as st
from dotenv import load_dotenv
from fastembed import TextEmbedding

load_dotenv()

VOICES_URL = "https://api.smallest.ai/waves/v1/lightning-v3.1/get_voices"
CLONED_VOICES_URL = "https://api.smallest.ai/waves/v1/voice-cloning"
SYNTHESIS_URL = "https://api.smallest.ai/waves/v1/tts"

MODELS = {
    "Lightning v3.1": "lightning_v3.1",
    "Lightning v3.1 Pro": "lightning_v3.1_pro",
}

SAMPLE_RATE = 24000
COLS = 4

_C_BG     = "#092023"
_C_DARK   = "#1D4E52"
_C_TEAL   = "#43B6B6"
_C_CREAM  = "#FBFAF5"
_C_YELLOW = "#FFCF72"
_C_CORAL  = "#FF5E5E"
_C_BLUE   = "#3E91D6"


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


@st.cache_data(ttl=300)
def fetch_voices(model: str, api_key: str) -> list[dict]:
    # One catalog serves both v3.1 and v3.1 Pro; the model is picked at synthesis time.
    resp = requests.get(
        VOICES_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("voices", [])


@st.cache_data(ttl=300)
def fetch_cloned_voices(api_key: str) -> list[dict]:
    resp = requests.get(
        CLONED_VOICES_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    resp.raise_for_status()
    clones = resp.json().get("data", [])
    return [v for v in clones if v.get("status") == "completed"]


def synthesize(text: str, voice_id: str, model: str, api_key: str) -> bytes:
    resp = requests.post(
        SYNTHESIS_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"text": text, "voice_id": voice_id, "model": model, "sample_rate": SAMPLE_RATE, "speed": 1.0, "output_format": "pcm"},
        timeout=30,
    )
    resp.raise_for_status()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(resp.content)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Semantic search
# ---------------------------------------------------------------------------


@st.cache_resource(show_spinner="Loading semantic search model...")
def _load_embed_model() -> TextEmbedding:
    return TextEmbedding("BAAI/bge-small-en-v1.5")


def _voice_text(voice: dict, is_cloned: bool = False) -> str:
    tags = voice.get("tags") or {}
    parts = [voice.get("displayName", "")]

    for field in ("gender", "age"):
        val = tags.get(field, "")
        if val:
            parts.append(val)

    accent = tags.get("accent", "")
    if accent:
        parts.append(f"{accent} accent")

    if is_cloned:
        raw = voice.get("tags", [])
        if isinstance(raw, list) and raw:
            parts.append(" ".join(raw))
        parts.append("cloned voice")
    else:
        langs = tags.get("language", [])
        if langs:
            parts.append(" ".join(langs))
        emotions = tags.get("emotions", [])
        if emotions:
            parts.append("emotions: " + " ".join(emotions))
        usecases = tags.get("usecases", [])
        if usecases:
            parts.append("usecases: " + " ".join(usecases))

    return " ".join(parts)


@st.cache_data(show_spinner=False)
def _build_embeddings(voice_texts: tuple) -> np.ndarray:
    return np.array(list(_load_embed_model().embed(list(voice_texts))))


def semantic_filter(query: str, voices: list[dict], is_cloned: bool = False, top_k: int = 20) -> list[dict]:
    if not query.strip():
        return voices

    texts = tuple(_voice_text(v, is_cloned) for v in voices)
    embeddings = _build_embeddings(texts)

    query_emb = np.array(list(_load_embed_model().embed([query])))[0]
    a = query_emb / (np.linalg.norm(query_emb) + 1e-10)
    b = embeddings / (np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10)
    scores = b @ a

    ranked = sorted(zip(scores.tolist(), voices), key=lambda x: x[0], reverse=True)
    top_score = ranked[0][0] if ranked else 0
    filtered = [v for s, v in ranked if s >= top_score * 0.85]
    return filtered[:top_k]


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------


def _tag_pill(text: str, color: str = _C_DARK, text_color: str = _C_CREAM) -> str:
    return (
        f'<span style="background:{color};color:{text_color};'
        f'padding:2px 10px;border-radius:99px;font-size:0.72em;'
        f'margin:2px;display:inline-block">{text}</span>'
    )


def _cache_key(voice_id: str, model: str, text: str) -> str:
    return f"{voice_id}__{model}__{hashlib.md5(text.encode()).hexdigest()[:8]}"


def render_voice_card(voice: dict, is_cloned: bool, preview_text: str, model: str, api_key: str) -> None:
    tags = voice.get("tags") or {}
    voice_id = voice["voiceId"]

    if is_cloned:
        gender, accent, languages, usecases, emotions, age = "", "", [], [], [], ""
        raw_tags: list[str] = tags if isinstance(tags, list) else []
    else:
        gender   = tags.get("gender", "")
        accent   = tags.get("accent", "")
        languages = tags.get("language", [])
        usecases  = tags.get("usecases", [])
        emotions  = tags.get("emotions", [])
        age       = tags.get("age", "")
        raw_tags  = []

    with st.container(border=True):
        st.markdown(f"**{voice.get('displayName', voice_id)}**")

        pills = ""
        if gender:   pills += _tag_pill(gender.capitalize(), _C_DARK)
        if age:      pills += _tag_pill(age, _C_YELLOW, _C_BG)
        if accent:   pills += _tag_pill(accent, _C_BLUE)
        for lang in languages: pills += _tag_pill(lang, _C_TEAL, _C_BG)
        for uc in usecases:    pills += _tag_pill(uc, _C_DARK)
        for t in raw_tags:     pills += _tag_pill(t, _C_DARK)
        if is_cloned:          pills += _tag_pill("cloned", _C_CORAL, _C_BG)
        if pills:
            st.markdown(pills, unsafe_allow_html=True)

        if emotions:
            preview = ", ".join(emotions[:3]) + (f" +{len(emotions) - 3}" if len(emotions) > 3 else "")
            st.caption(f"Emotions: {preview}")

        key = _cache_key(voice_id, model, preview_text)
        cached = st.session_state.get("audio_cache", {}).get(key)
        nonce = st.session_state.get(f"nonce_{key}", 0)

        if cached:
            b64 = base64.b64encode(cached).decode()
            autoplay = "autoplay" if st.session_state.get("audio_autoplay") == key else ""
            if autoplay:
                st.session_state["audio_autoplay"] = None
            st.markdown(
                f'<audio {autoplay} controls src="data:audio/wav;base64,{b64}#{nonce}"'
                f' style="width:100%;margin-top:4px"></audio>',
                unsafe_allow_html=True,
            )

        if st.button("Try it", key=f"play_{voice_id}", use_container_width=True):
            if not preview_text.strip():
                st.warning("Enter preview text above.")
            else:
                if key not in st.session_state.get("audio_cache", {}):
                    with st.spinner("Generating..."):
                        try:
                            audio = synthesize(preview_text, voice_id, model, api_key)
                            st.session_state.setdefault("audio_cache", {})[key] = audio
                        except requests.HTTPError as e:
                            detail = ""
                            try:
                                err = e.response.json().get("error")
                                if isinstance(err, list) and err:
                                    detail = err[0].get("message", "")
                                elif isinstance(err, str):
                                    detail = err
                            except Exception:
                                pass
                            st.error(f"Synthesis failed: {e.response.status_code}" + (f" ({detail})" if detail else ""))
                            st.stop()
                st.session_state[f"nonce_{key}"] = nonce + 1
                st.session_state["audio_autoplay"] = key
                st.rerun()


def render_voice_grid(voices: list[dict], is_cloned: bool, preview_text: str, model: str, api_key: str) -> None:
    if not voices:
        st.info("No voices found." + (" Clone a voice at smallest.ai to see it here." if is_cloned else ""))
        return
    cols = st.columns(COLS)
    for i, voice in enumerate(voices):
        with cols[i % COLS]:
            render_voice_card(voice, is_cloned, preview_text, model, api_key)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    st.set_page_config(page_title="Voice Explorer - Smallest AI", layout="wide")

    st.markdown(
        """
        <style>
        div[data-testid="stButton"] > button {
            background-color: #43B6B6; color: #092023; font-weight: 600; border: none;
        }
        div[data-testid="stButton"] > button:hover {
            background-color: #FBFAF5; color: #092023;
        }
        h2 { color: #43B6B6 !important; }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.title("Voice Explorer")
    st.caption("Preview every Smallest AI voice. Search by use case, emotion, accent, or language.")

    api_key = os.getenv("SMALLEST_API_KEY", "")
    if not api_key:
        st.error("Set `SMALLEST_API_KEY` in your `.env` file.")
        st.stop()

    col_text, col_model = st.columns([3, 1])
    with col_text:
        preview_text = st.text_input(
            "Preview text",
            value="Hello! I'm your AI assistant. How can I help you today?",
            placeholder="Type something to hear each voice say it...",
        )
    with col_model:
        model_label = st.selectbox(
            "Model",
            list(MODELS.keys()),
            help="v3.1 and v3.1 Pro serve different voice pools; a voice that fails on one model may be available on the other.",
        )
    model = MODELS[model_label]

    search_query = st.text_input(
        "Search by use case or attributes",
        placeholder="e.g. calm meditation, news anchor, warm storytelling, British female...",
    )

    st.divider()

    try:
        all_voices = fetch_voices(model, api_key)
    except requests.HTTPError as e:
        st.error(f"Failed to fetch voices: {e}")
        st.stop()

    try:
        cloned_voices = fetch_cloned_voices(api_key)
    except requests.HTTPError:
        cloned_voices = []

    filtered_voices = semantic_filter(search_query, all_voices)
    filtered_cloned = semantic_filter(search_query, cloned_voices, is_cloned=True) if cloned_voices else []

    st.subheader(f"Standard Voices ({len(filtered_voices)})")
    if search_query and len(filtered_voices) < len(all_voices):
        st.caption(f"Showing {len(filtered_voices)} of {len(all_voices)} voices matching '{search_query}'")
    render_voice_grid(filtered_voices, is_cloned=False, preview_text=preview_text, model=model, api_key=api_key)

    if cloned_voices:
        st.divider()
        st.subheader(f"Your Cloned Voices ({len(filtered_cloned)})")
        render_voice_grid(filtered_cloned, is_cloned=True, preview_text=preview_text, model=model, api_key=api_key)


if __name__ == "__main__":
    main()
