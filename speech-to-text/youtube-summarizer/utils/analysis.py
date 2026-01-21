import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def get_groq():
    if not GROQ_API_KEY: return None
    return Groq(api_key=GROQ_API_KEY)

def analyze_transcript(text):
    """Send transcript to Groq for summarization."""
    client = get_groq()
    if not client: return None
    
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
