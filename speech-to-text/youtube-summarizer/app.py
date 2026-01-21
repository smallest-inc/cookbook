"""
YouTube Summarizer (YT Summarizer)
Powered by Smallest AI Pulse + Groq + yt-dlp
"""
import streamlit as st
import time
import os
from dotenv import load_dotenv

# Helpers
# Helpers
import requests
from youtube import get_video_info, download_audio
from transcription import transcribe_bytes
from analysis import analyze_transcript

@st.cache_resource
def get_api_session():
    return requests.Session()

load_dotenv()

st.set_page_config(page_title="📺 YT Summarizer", page_icon="⚡", layout="wide")

# Custom Styles
st.markdown("""
<style>
    .stApp { background-color: #ffffff; color: #333333; }
    .summary-card {
        background: #f8f9fa;
        border-left: 4px solid #00ff9d;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
    }
    button[kind="primary"] {
        background: linear-gradient(90deg, #111 0%, #333 100%);
        color: white !important;
        border: none;
    }
    img { border-radius: 12px; }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown("""
<div style="display: flex; align-items: center; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 2.5rem; font-weight: 800;">⚡ YT Summarizer</h1>
</div>
""", unsafe_allow_html=True)
st.markdown("<p style='color: #666; font-size: 1.2rem;'>Powered by <b style='color: #00ff9d'>Smallest Pulse</b></p>", unsafe_allow_html=True)

# Input Tabs
tab_yt, tab_file = st.tabs(["🔗 YouTube Link", "PY Upload File"])
url = None
uploaded_file = None

with tab_yt:
    url = st.text_input("Paste URL:", placeholder="https://youtube.com/watch?v=...", label_visibility="collapsed")
with tab_file:
    uploaded_file = st.file_uploader("Upload Audio/Video", type=['mp3', 'wav', 'mp4', 'm4a', 'mov'])

analyze_btn = st.button("🔥 Summon", type="primary", use_container_width=True)

if analyze_btn:
    audio_bytes = None
    info = {} # Dummy info
    
    # 1. Acquire Media
    if uploaded_file:
        with st.spinner("Reading file..."):
            audio_bytes = uploaded_file.read()
            info = {'title': uploaded_file.name, 'uploader': 'Local File', 'thumbnail': None}
    elif url:
        with st.spinner("Fetching..."):
            info = get_video_info(url)
            if not info:
                st.error("Invalid URL"); st.stop()
        
        with st.spinner("Extracting Audio..."):
            try:
                audio_file = download_audio(url)
                with open(audio_file, "rb") as f:
                    audio_bytes = f.read()
            except Exception as e:
                st.error(f"Download blocked: {e}"); st.stop()
    else:
        st.warning("Please provide a URL or Upload a file."); st.stop()

    # Layout: Media Info
    if info.get('thumbnail'):
        c1, c2 = st.columns([1, 2])
        c1.image(info['thumbnail'], use_container_width=True)
        c2.subheader(info.get('title'))
        c2.caption(f"Source: **{info.get('uploader')}**")
    else:
        st.subheader(info.get('title'))
        st.caption(f"Source: **{info.get('uploader')}**")

    st.divider()
    step_box = st.empty()
    
    # 2. Pipeline
    try:
        # A. Transcribe (Pulse)
        step_box.info("👂 Pulse is listening...")
        session = get_api_session()
        t0 = time.time()
        pulse_data = transcribe_bytes(audio_bytes, session=session)
        stt_time = time.time() - t0
        
        if "error" in pulse_data:
            step_box.error(pulse_data["error"]); st.stop()
            
        transcript_text = pulse_data.get('transcript') or pulse_data.get('text') or pulse_data.get('transcription')
        if not transcript_text:
             step_box.error(f"No transcript found. Keys: {list(pulse_data.keys())}"); st.stop()

        # B. Analyze (Groq)
        step_box.info("🧠 Groq is summarizing...")
        analysis = analyze_transcript(transcript_text)
        
        step_box.empty()
        st.metric("Model Latency (Pulse)", f"{stt_time:.3f}s")
        st.caption("Pure Network Request Time")
        
        # 3. Results
        if analysis:
            st.markdown("### 📝 Executive Summary")
            st.markdown(f"<div class='summary-card'>{analysis.get('summary')}</div>", unsafe_allow_html=True)
            
            st.markdown("### 🗝️ Key Takeaways")
            for point in analysis.get('key_points', []):
                st.markdown(f"- {point}")
            
            with st.expander("📜 Full Transcript (Raw)"):
                st.code(transcript_text, language="text")
                
        # Cleanup
        if url and not uploaded_file:
             try: os.remove("temp_audio.mp3")
             except: pass
        
    except Exception as e:
        step_box.error(f"Pipeline failed: {e}")
