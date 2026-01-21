"""
YouTube Transcriber & Summarizer
Powered by Smallest AI Pulse + Groq + yt-dlp
"""
import os
import sys
import time
import json
import requests
import yt_dlp
import re
from dotenv import load_dotenv

try:
    import streamlit as st
    from groq import Groq
except ImportError as e:
    print(f"Missing dependency: {e}")
    sys.exit(1)

load_dotenv()

# Config
SMALLEST_API_KEY = os.getenv("SMALLEST_API_KEY")
SMALLEST_STT_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

st.set_page_config(page_title="📺 YouTube Summoner", page_icon="📺", layout="wide")

# Custom CSS - Standard Light Theme
st.markdown("""
<style>
    .stApp { 
        background-color: #ffffff; 
        color: #333333;
    }
    .main-header {
        font-size: 3rem;
        font-weight: 800;
        color: #000000;
        margin-bottom: 0;
    }
    .sub-header {
        color: #666666;
        font-size: 1.2rem;
        margin-bottom: 2rem;
    }
    .stat-box {
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 15px;
        text-align: center;
        transition: transform 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .stat-box:hover {
        transform: translateY(-2px);
        border-color: #00ff9d;
    }
    .stat-value {
        font-size: 1.5rem;
        font-weight: bold;
        color: #333;
    }
    .stat-label {
        font-size: 0.8rem;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .summary-card {
        background: #f8f9fa;
        border-left: 4px solid #00ff9d;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .vibe-tag {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        background: rgba(0, 204, 122, 0.1); /* Darker teal for visibility */
        color: #00995c;
        font-size: 0.8rem;
        font-weight: bold;
        margin-right: 5px;
        border: 1px solid rgba(0, 204, 122, 0.2);
    }
    .metadata-tag {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        background: #e9ecef;
        color: #495057;
        font-size: 0.8rem;
        margin-right: 5px;
    }
    div[data-testid="stExpander"] {
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
    }
    button[kind="primary"] {
        background: linear-gradient(90deg, #111 0%, #333 100%);
        color: white !important;
        border: none;
    }
    img {
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
</style>
""", unsafe_allow_html=True)

@st.cache_resource
def get_groq():
    return Groq(api_key=GROQ_API_KEY)

def get_video_info(url):
    ydl_opts = {'quiet': True, 'no_warnings': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return info
        except Exception as e:
            return None

def download_audio(url):
    output_filename = "temp_audio"
    # Remove existing
    for ext in ['mp3', 'm4a', 'webm', 'wav']:
        try: os.remove(f"{output_filename}.{ext}")
        except: pass

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_filename,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    
    return f"{output_filename}.mp3"

def transcribe_bytes(audio_bytes):
    if not SMALLEST_API_KEY: return {"error": "Error: No API Key"}
    
    headers = {
        "Authorization": f"Bearer {SMALLEST_API_KEY}",
        "Content-Type": "audio/mpeg"
    }
    # Pure STT for maximum speed
    params = {
        "model": "pulse",
        "language": "en"
    }
    
    try:
        response = requests.post(
            SMALLEST_STT_URL, 
            headers=headers, 
            params=params, 
            data=audio_bytes
        )
        
        # DEBUG PRINT TO TERMINAL
        print(f"--------------------------------------------------")
        print(f"DEBUG: Pulse Status Code: {response.status_code}")
        print(f"DEBUG: Pulse Raw Response: {response.text[:1000]}") 
        print(f"--------------------------------------------------")

        if response.status_code == 200:
            return response.json()
        return {"error": f"Error {response.status_code}: {response.text}"}
    except Exception as e:
        print(f"DEBUG EXCEPTION: {e}")
        return {"error": str(e)}

def analyze_transcript(text):
    client = get_groq()
    prompt = f"""
    Summarize this YouTube video transcript.
    
    Transcript Snippet: "{text[:15000]}"
    
    Return JSON with:
    1. 'summary': A punchy 3-sentence summary.
    2. 'key_points': List of 5 actionable bullet points (strings).
    3. 'rating': A score 1-10 on "Value Density".
    """
    
    try:
        resp = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-120b",
            response_format={"type": "json_object"}
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        return None

# UI Header
st.markdown("""
<div style="display: flex; align-items: center; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 2.5rem; font-weight: 800;">⚡ YT Summarizer</h1>
</div>
""", unsafe_allow_html=True)
st.markdown("<p class='sub-header'>Powered by <b style='color: #00ff9d'>Smallest Pulse</b></p>", unsafe_allow_html=True)

# Input
tab_yt, tab_file = st.tabs(["🔗 YouTube Link", "PY Upload File"])

url = None
uploaded_file = None

with tab_yt:
    url = st.text_input("Paste URL:", placeholder="https://youtube.com/watch?v=...", label_visibility="collapsed")
    
with tab_file:
    uploaded_file = st.file_uploader("Upload Audio/Video", type=['mp3', 'wav', 'mp4', 'm4a', 'mov'])

analyze_btn = st.button("🔥 Summon", type="primary", use_container_width=True)

if analyze_btn:
    # Determine Source
    audio_bytes = None
    info = {} # Dummy info for title/thumb
    
    if uploaded_file:
        # METHOD 1: Direct File
        with st.spinner("Reading file..."):
            audio_bytes = uploaded_file.read()
            info = {
                'title': uploaded_file.name,
                'uploader': 'Local File',
                'duration_string': 'Unknown',
                'thumbnail': None 
            }
            
    elif url:
        # METHOD 2: YouTube
        with st.spinner("Fetching..."):
            info = get_video_info(url)
        
        if not info:
             st.error("Invalid URL")
             st.stop()
             
        # Download (if not file)
        with st.spinner("Extracting Audio..."):
            try:
                audio_file = download_audio(url)
                with open(audio_file, "rb") as f:
                    audio_bytes = f.read()
            except Exception as e:
                st.error(f"Download blocked: {e}")
                st.stop()
    else:
        st.warning("Please provide a URL or Upload a file.")
        st.stop()

    # Layout: Thumbnail (if any) | Stats
    if info.get('thumbnail'):
        col_thumb, col_stats = st.columns([1, 2])
        with col_thumb:
            st.image(info.get('thumbnail'), use_container_width=True)
        with col_stats:
            st.subheader(info.get('title'))
            st.caption(f"Source: **{info.get('uploader')}** • Duration: **{info.get('duration_string')}**")
    else:
        st.subheader(info.get('title'))
        st.caption(f"Source: **{info.get('uploader')}**")

    step_box = st.empty()
    st.divider()
    
    # 2. Pipeline Execution
    try:
        # Step B: Transcribe
        step_box.info("👂 Pulse is listening...")
        
        t0 = time.time()
        pulse_data = transcribe_bytes(audio_bytes)
        stt_time = time.time() - t0
        
        # Check for error
        if isinstance(pulse_data, dict) and "error" in pulse_data:
            step_box.error(pulse_data["error"])
            st.stop()
            
        # Extract transcript for Groq
        transcript_text = pulse_data.get('transcript') or pulse_data.get('text') or pulse_data.get('transcription')
        
        if not transcript_text:
             # DEBUG: Show what we actually got
             step_box.error(f"No transcript found. Response Keys: {list(pulse_data.keys())}")
             with st.expander("Debug Raw Response"):
                 st.write(pulse_data)
             st.stop()

        # Step D: Groq Summary (Text Only)
        step_box.info("🧠 Groq is summarizing...")
        analysis = analyze_transcript(transcript_text)
        
        # Benchmarks Context
        step_box.empty() # Clear status
        
        st.metric("Model Latency (Pulse)", f"{stt_time:.3f}s")
        st.caption("Pure Network Request Time")
        
        # 3. Display Results
        if analysis:
            
            # Main Summary (FROM GROQ)
            st.markdown("### 📝 Executive Summary")
            st.markdown(f"<div class='summary-card'>{analysis.get('summary')}</div>", unsafe_allow_html=True)
            
            # Key Points
            st.markdown("### 🗝️ Key Takeaways")
            for point in analysis.get('key_points', []):
                st.markdown(f"- {point}")
            
            # Transcript Expander
            with st.expander("📜 Full Transcript (Raw)"):
                st.code(transcript_text, language="text")
                
        # Cleanup temp file if yt
        if url and not uploaded_file:
             try: os.remove("temp_audio.mp3")
             except: pass
        
    except Exception as e:
        step_box.error(f"Pipeline failed: {e}")
