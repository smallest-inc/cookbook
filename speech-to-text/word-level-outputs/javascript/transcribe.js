#!/usr/bin/env node
/**
 * Smallest AI Speech-to-Text - Word-Level Outputs
 *
 * Transcribe audio with word-level timestamps and speaker diarization,
 * showing timing and speaker information for each word and utterance.
 *
 * Usage: node transcribe.js <audio_file>
 *
 * Output:
 * - Command line response with word timestamps and utterances
 * - {filename}_result.json - Full result with words and utterances
 */

const fs = require("fs");
const path = require("path");

const API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text";

const LANGUAGE = "en"; // Use ISO 639-1 codes or "multi" for auto-detect
const WORD_TIMESTAMPS = true;
const DIARIZE = true;

async function transcribe(audioFile, apiKey) {
  const audioData = fs.readFileSync(audioFile);

  const params = new URLSearchParams({
    language: LANGUAGE,
    word_timestamps: String(WORD_TIMESTAMPS).toLowerCase(),
    diarize: String(DIARIZE).toLowerCase(),
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

// This function is designed to process feature outputs ONLY for word-level timestamps and speaker diarization
function processResponse(result, audioPath) {
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

  // Utterances (speaker diarization)
  const utterances = result.utterances || [];
  if (utterances.length > 0) {
    console.log("");
    console.log("-".repeat(60));
    console.log("UTTERANCES");
    console.log("-".repeat(60));
    for (const utt of utterances) {
      const speaker = utt.speaker || "";
      const start = (utt.start || 0).toFixed(2);
      const end = (utt.end || 0).toFixed(2);
      const text = utt.text || "";
      if (speaker) {
        console.log(`[${start}s - ${end}s] ${speaker}: ${text}`);
      } else {
        console.log(`[${start}s - ${end}s] ${text}`);
      }
    }
  }

  // Word timestamps
  const words = result.words || [];
  if (words.length > 0) {
    console.log("");
    console.log("-".repeat(60));
    console.log("WORD TIMESTAMPS");
    console.log("-".repeat(60));
    for (const word of words) {
      const start = (word.start || 0).toFixed(2);
      const end = (word.end || 0).toFixed(2);
      const text = word.word || "";
      const speaker = word.speaker || "";
      if (speaker) {
        console.log(`[${start}s - ${end}s] ${speaker}: ${text}`);
      } else {
        console.log(`[${start}s - ${end}s] ${text}`);
      }
    }
  }

  console.log("");
  console.log("=".repeat(60));

  const baseName = path.basename(audioPath, path.extname(audioPath));
  const jsonPath = `${baseName}_result.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`Saved: ${jsonPath}`);
  console.log("Done!");
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

  console.log(`Transcribing: ${path.basename(audioFile)}`);

  const result = await transcribe(audioFile, apiKey);
  processResponse(result, audioFile);
}

main();
