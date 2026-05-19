/**
 * Text-to-Speech Quickstart — JavaScript
 * Generate speech using the unified Lightning TTS route.
 *
 * Targets the Lightning v3.1 Pro pool — drop the `model` field (or set it to
 * `"lightning_v3.1"`) to use the standard Lightning v3.1 pool instead.
 *
 * Usage:
 *     export SMALLEST_API_KEY="your-api-key"
 *     node quickstart-javascript.js
 *
 * Docs: https://docs.smallest.ai/waves/documentation/text-to-speech-lightning/quickstart
 */

const fs = require("fs");

const API_KEY = process.env.SMALLEST_API_KEY;

const response = await fetch(
  "https://api.smallest.ai/waves/v1/tts",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: "Modern problems require modern solutions.",
      voice_id: "meher",
      model: "lightning_v3.1_pro",
      sample_rate: 24000,
      speed: 1.0,
      language: "en",
      output_format: "wav",
    }),
  }
);

if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync("output.wav", buffer);
console.log(`Saved output.wav (${buffer.length} bytes)`);
