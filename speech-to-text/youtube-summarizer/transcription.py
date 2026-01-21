import os
import requests
from dotenv import load_dotenv

load_dotenv()

SMALLEST_API_KEY = os.getenv("SMALLEST_API_KEY")
SMALLEST_STT_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text"

# Global session to reuse TCP connections (Keep-Alive)
session = requests.Session()

def transcribe_bytes(audio_bytes, session=None):
    """Send audio bytes to Pulse STT API."""
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
        requester = session if session else requests
        response = requester.post(
            SMALLEST_STT_URL, 
            headers=headers, 
            params=params, 
            data=audio_bytes
        )
        
        # DEBUG PRINT TO TERMINAL (Optional, can be removed for production)
        # print(f"DEBUG: Pulse Status Code: {response.status_code}")

        if response.status_code == 200:
            return response.json()
        return {"error": f"Error {response.status_code}: {response.text}"}
    except Exception as e:
        return {"error": str(e)}
