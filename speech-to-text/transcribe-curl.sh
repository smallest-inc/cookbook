#!/bin/bash
# Speech-to-Text Quickstart — cURL
# Transcribe audio using Pulse STT (URL-based).
#
# Usage:
#     export SMALLEST_API_KEY="your-api-key"
#     bash transcribe-curl.sh
#
# Docs: https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/quickstart

curl -X POST "https://api.smallest.ai/waves/v1/stt/?model=pulse&language=en" \
  -H "Authorization: Bearer $SMALLEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/smallest-inc/cookbook/raw/main/speech-to-text/getting-started/samples/audio.wav"}'
