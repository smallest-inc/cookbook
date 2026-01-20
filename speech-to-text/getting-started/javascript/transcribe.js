#!/usr/bin/env node
/**
 * Smallest AI Speech-to-Text - Getting Started
 *
 * The simplest way to transcribe audio using Smallest AI's Pulse STT API.
 *
 * Usage: node transcribe.js <audio_file>
 *
 * Output:
 * - Command line response with transcription
 */

const fs = require("fs");

const API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text";

// Features
const LANGUAGE = "en"; // Use ISO 639-1 codes or "multi" for auto-detect

async function transcribe(audioFile, apiKey) {
  const audioData = fs.readFileSync(audioFile);

  const params = new URLSearchParams({
    language: LANGUAGE,
  });

  const response = await fetch(`${API_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/octet-stream",
    },
    body: audioData,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function processResponse(result) {
  if (result.status !== "success") {
    console.error("Error: Transcription failed");
    console.error(result);
    process.exit(1);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("TRANSCRIPTION");
  console.log("=".repeat(60));
  console.log(result.transcription || "");
  console.log("=".repeat(60));
  console.log("");
}

async function main() {
  const audioFile = process.argv[2];

  if (!audioFile) {
    console.log("Usage: node transcribe.js <audio_file>");
    process.exit(1);
  }

  const apiKey = process.env.SMALLEST_API_KEY;

  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  if (!fs.existsSync(audioFile)) {
    console.error(`Error: File not found: ${audioFile}`);
    process.exit(1);
  }

  const result = await transcribe(audioFile, apiKey);
  processResponse(result);
}

main();
