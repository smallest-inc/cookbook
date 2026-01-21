import os
import yt_dlp

def get_video_info(url):
    """Fetch video metadata without downloading."""
    ydl_opts = {'quiet': True, 'no_warnings': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return info
        except Exception as e:
            return None

def download_audio(url):
    """Download video audio to a temporary MP3 file."""
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
