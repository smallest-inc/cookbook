"""
Shared WebSocket session manager for Smallest AI Speech-to-Text API.

This module provides a reusable TranscriptionSession class for managing
WebSocket connections to the Pulse STT API across multiple applications.
"""

import json
import queue
import threading
from typing import List, Optional
from urllib.parse import urlencode

from websockets.sync.client import connect


class TranscriptionSession:
    """
    Manages a WebSocket connection to the Smallest AI Pulse STT API.
    
    This class handles:
    - WebSocket connection lifecycle
    - Audio streaming
    - Response reception in a background thread
    - Session cleanup
    
    Attributes:
        ws: WebSocket connection object
        response_queue: Queue for storing transcription results
        receiver_thread: Background thread for receiving responses
        is_active: Flag indicating if session is active
        prev: Last transcript text (for simple use cases)
    """
    
    def __init__(self):
        self.ws = None
        self.response_queue = queue.Queue()
        self.receiver_thread = None
        self.is_active = False
        self.prev = ""

    def start(
        self,
        api_key: str,
        ws_url: str = "wss://api.smallest.ai/waves/v1/pulse/get_text",
        language: str = "en",
        sample_rate: int = 16000,
        encoding: str = "linear16",
        raise_on_error: bool = False,
    ):
        """
        Start a new transcription session.
        
        Args:
            api_key: Smallest AI API key
            ws_url: WebSocket endpoint URL
            language: Language code ('en', 'multi', etc.)
            sample_rate: Audio sample rate in Hz
            encoding: Audio encoding format
            raise_on_error: If True, raise RuntimeError on connection failure.
                          If False, store error in self.prev
        """
        if self.is_active:
            return

        self.close()

        params = {
            "language": language,
            "encoding": encoding,
            "sample_rate": sample_rate,
        }
        url = f"{ws_url}?{urlencode(params)}"
        headers = {"Authorization": f"Bearer {api_key}"}

        try:
            self.ws = connect(url, additional_headers=headers, open_timeout=30)
        except TimeoutError as e:
            error_msg = "Error: Connection timed out. Please try again."
            if raise_on_error:
                raise RuntimeError(error_msg) from e
            self.prev = error_msg
            return
        except Exception as e:
            error_msg = f"Error connecting to STT WebSocket: {e}"
            if raise_on_error:
                raise RuntimeError(error_msg) from e
            self.prev = f"Error: {str(e)}"
            return

        self.is_active = True
        self.response_queue = queue.Queue()
        self.prev = ""

        self.receiver_thread = threading.Thread(target=self._receive_responses, daemon=True)
        self.receiver_thread.start()

    def _receive_responses(self):
        """Background thread that receives and queues WebSocket messages."""
        try:
            for message in self.ws:
                result = json.loads(message)
                if result.get("is_final"):
                    self.response_queue.put(result)
                if result.get("is_last"):
                    break
        except Exception as e:
            self.response_queue.put({"error": str(e)})
        finally:
            self.is_active = False

    def send_audio(self, audio_data: bytes):
        """
        Send audio data to the WebSocket.
        
        Args:
            audio_data: Raw audio bytes in the configured encoding
        """
        if self.ws and self.is_active:
            try:
                self.ws.send(audio_data)
            except Exception:
                self.is_active = False

    def end_session(self):
        """Signal the end of the audio stream to the server."""
        if self.ws and self.is_active:
            try:
                self.ws.send(json.dumps({"type": "finalize"}))
            except Exception:
                pass

    def consume_results(self) -> List[dict]:
        """
        Retrieve all pending transcription results from the queue.
        
        Returns:
            List of result dictionaries containing transcription data
        """
        results = []
        while not self.response_queue.empty():
            try:
                results.append(self.response_queue.get_nowait())
            except queue.Empty:
                break
        return results

    def get_transcript(self) -> str:
        """
        Get the latest transcript text (simple interface).
        
        This method updates self.prev with the latest transcript
        and returns it. Useful for applications that only need
        the most recent text.
        
        Returns:
            Latest transcript text or error message
        """
        while not self.response_queue.empty():
            try:
                result = self.response_queue.get_nowait()
                if result.get("error"):
                    return f"Error: {result['error']}"
                self.prev = result.get("transcript", "")
            except queue.Empty:
                break
        return self.prev

    def close(self):
        """Close the WebSocket connection and cleanup resources."""
        self.is_active = False
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None
