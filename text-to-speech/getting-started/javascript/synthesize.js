#!/usr/bin/env node
/**
 * Smallest AI Text-to-Speech - Getting Started
 *
 * The simplest way to generate speech using Smallest AI's Lightning TTS API.
 *
 * Usage: node synthesize.js "Text to speak" [output_file]
 *
 * Output:
 * - WAV audio file (default: output.wav)
 */

const fs = require("fs");

// Configuration
const MODEL = "lightning-v3.1";
const VOICE_ID = "sophia";
const SPEED = 1.0;
const SAMPLE_RATE = 24000;
const LANGUAGE = "en"; // en, hi, es, ta
const OUTPUT_FORMAT = "wav";

const API_BASE = "https://api.smallest.ai/waves/v1";

async function synthesize(text, apiKey) {
  const response = await fetch(`${API_BASE}/${MODEL}/get_speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: VOICE_ID,
      speed: SPEED,
      sample_rate: SAMPLE_RATE,
      language: LANGUAGE,
      output_format: OUTPUT_FORMAT,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `API request failed (${response.status}): ${await response.text()}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const text = process.argv[2];
  const outputFile = process.argv[3] || "output.wav";

  if (!text) {
    console.log('Usage: node synthesize.js "Text to speak" [output_file]');
    process.exit(1);
  }

  const apiKey = process.env.SMALLEST_API_KEY;

  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  console.log(`Generating speech with ${MODEL} (${VOICE_ID})...`);
  const audio = await synthesize(text, apiKey);

  fs.writeFileSync(outputFile, audio);
  console.log(`Saved to ${outputFile} (${audio.length.toLocaleString()} bytes)`);
}

main();
