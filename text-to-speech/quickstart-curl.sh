#!/bin/bash
# Text-to-Speech Quickstart — cURL
# Generate speech from text using the unified Lightning TTS route.
# Targets the Lightning v3.1 Pro pool — drop the `model` field to use the
# standard Lightning v3.1 pool instead.
#
# Usage:
#     export SMALLEST_API_KEY="your-api-key"
#     bash quickstart-curl.sh
#
# Docs: https://docs.smallest.ai/waves/documentation/text-to-speech-lightning/quickstart

curl -X POST "https://api.smallest.ai/waves/v1/tts" \
  -H "Authorization: Bearer $SMALLEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Modern problems require modern solutions.","voice_id":"meher","model":"lightning_v3.1_pro","sample_rate":24000,"speed":1.0,"language":"en","output_format":"wav"}' \
  --output output.wav

echo "Saved output.wav ($(wc -c < output.wav) bytes)"
