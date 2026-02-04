#!/usr/bin/env python3
"""
Async Batch Audio Transcription with Pulse STT

Transcribe multiple audio files concurrently with rate limiting.

Usage:
    python async_batch.py ./episodes/*.mp3
    python async_batch.py file1.wav file2.wav file3.wav --concurrent 3

Requirements:
    pip install httpx
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path
from typing import Optional

import httpx


class AsyncPulseClient:
    """Async client for batch transcription with Pulse STT."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("SMALLEST_API_KEY")
        if not self.api_key:
            raise ValueError("SMALLEST_API_KEY environment variable not set")
        self.base_url = "https://waves-api.smallest.ai/api/v1/pulse/get_text"

    async def transcribe_batch(
        self,
        file_paths: list[str],
        language: str = "en",
        max_concurrent: int = 5
    ) -> list[dict]:
        """
        Transcribe multiple files concurrently with rate limiting.
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async with httpx.AsyncClient(timeout=120.0) as client:
            tasks = [
                self._transcribe_with_semaphore(client, path, language, semaphore)
                for path in file_paths
            ]
            return await asyncio.gather(*tasks, return_exceptions=True)

    async def _transcribe_with_semaphore(
        self,
        client: httpx.AsyncClient,
        file_path: str,
        language: str,
        semaphore: asyncio.Semaphore
    ) -> dict:
        async with semaphore:
            return await self._transcribe_one(client, file_path, language)

    async def _transcribe_one(
        self,
        client: httpx.AsyncClient,
        file_path: str,
        language: str
    ) -> dict:
        ext = file_path.lower().split('.')[-1]
        content_type = {
            'wav': 'audio/wav',
            'mp3': 'audio/mpeg',
            'flac': 'audio/flac',
            'm4a': 'audio/mp4'
        }.get(ext, 'audio/wav')

        with open(file_path, "rb") as f:
            response = await client.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": content_type
                },
                params={"model": "pulse", "language": language},
                content=f.read()
            )

        response.raise_for_status()
        return {"file": file_path, "result": response.json()}


async def process_files(files: list[str], language: str, concurrent: int):
    """Process multiple audio files."""
    client = AsyncPulseClient()

    print(f"📁 Processing {len(files)} file(s)")
    print(f"🔄 Max concurrent: {concurrent}")
    print(f"🌐 Language: {language}")
    print()

    results = await client.transcribe_batch(
        files,
        language=language,
        max_concurrent=concurrent
    )

    print("=" * 60)
    print("📊 RESULTS")
    print("=" * 60)

    success = 0
    failed = 0

    for item in results:
        if isinstance(item, Exception):
            print(f"❌ Error: {item}")
            failed += 1
        else:
            file_name = Path(item['file']).name
            transcript = item['result'].get('transcription', '')
            char_count = len(transcript)
            print(f"✅ {file_name}: {char_count} chars")
            success += 1

    print()
    print(f"📈 Success: {success}, Failed: {failed}")


def main():
    parser = argparse.ArgumentParser(description="Batch transcribe audio files")
    parser.add_argument("files", nargs="+", help="Audio files to transcribe")
    parser.add_argument("--language", "-l", default="en",
                        help="Language code (en, hi, es, multi)")
    parser.add_argument("--concurrent", "-c", type=int, default=3,
                        help="Max concurrent requests (default: 3)")

    args = parser.parse_args()

    # Validate files exist
    valid_files = []
    for f in args.files:
        if os.path.exists(f):
            valid_files.append(f)
        else:
            print(f"⚠️  Skipping: {f} (not found)")

    if not valid_files:
        print("❌ No valid files to process")
        sys.exit(1)

    asyncio.run(process_files(valid_files, args.language, args.concurrent))


if __name__ == "__main__":
    main()
