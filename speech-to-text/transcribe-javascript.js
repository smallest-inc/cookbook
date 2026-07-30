/**
 * Speech-to-Text Quickstart — JavaScript
 * Transcribe audio using Pulse STT (URL-based, zero file dependencies).
 *
 * Usage:
 *     export SMALLEST_API_KEY="your-api-key"
 *     node transcribe-javascript.js
 *
 * Docs: https://docs.smallest.ai/waves/documentation/speech-to-text-pulse/quickstart
 */

const SAMPLE_URL = "https://github.com/smallest-inc/cookbook/raw/main/speech-to-text/getting-started/samples/audio.wav";

const params = new URLSearchParams({ model: "pulse", language: "en" });
const response = await fetch(
  `https://api.smallest.ai/waves/v1/stt/?${params}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SMALLEST_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: SAMPLE_URL }),
  }
);

if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

const result = await response.json();
console.log(`Transcription: ${result.transcription}`);
