#!/usr/bin/env node
/**
 * Smallest AI Speech-to-Text - File Transcription
 *
 * Transcribe audio files with advanced features like word timestamps,
 * speaker diarization, and emotion detection.
 *
 * Usage: node transcribe.js <audio_file>
 *
 * Output:
 * - Command line response with feature outputs
 * - {filename}_transcript.txt - Plain text transcription
 * - {filename}_result.json - Full API response
 */

const fs = require("fs");
const path = require("path");

const API_URL = "https://waves-api.smallest.ai/api/v1/pulse/get_text";
const OUTPUT_DIR = ".";

// The following are all the features supported by the POST endpoint (Pre-Recorded API)
const LANGUAGE = "en"; // Use ISO 639-1 codes or "multi" for auto-detect
const WORD_TIMESTAMPS = true;
const DIARIZE = true;
const AGE_DETECTION = true;
const GENDER_DETECTION = true;
const EMOTION_DETECTION = true;

async function transcribe(audioFile, apiKey) {
  const audioData = fs.readFileSync(audioFile);

  const params = new URLSearchParams({
    language: LANGUAGE,
    word_timestamps: WORD_TIMESTAMPS,
    diarize: DIARIZE,
    age_detection: AGE_DETECTION,
    gender_detection: GENDER_DETECTION,
    emotion_detection: EMOTION_DETECTION,
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

// This function is designed to process feature outputs for all the features supported
// by the POST endpoint (Pre-Recorded API)
function processResponse(result, audioPath) {
  if (result.status !== "success") {
    console.error("Error: Transcription failed");
    console.error(result);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TRANSCRIPTION");
  console.log("=".repeat(60));
  console.log(result.transcription || "");

  // Speaker info
  if (result.age || result.gender || result.emotions) {
    console.log("\n" + "-".repeat(60));
    console.log("SPEAKER INFO");
    console.log("-".repeat(60));
    if (result.gender) {
      console.log(`Gender: ${result.gender}`);
    }
    if (result.age) {
      console.log(`Age: ${result.age}`);
    }
    if (result.emotions) {
      console.log("Emotions:");
      const sortedEmotions = Object.entries(result.emotions).sort((a, b) => b[1] - a[1]);
      for (const [emotion, score] of sortedEmotions) {
        console.log(`  ${emotion}: ${score.toFixed(4)}`);
      }
    }
  }

  // Utterances (speaker diarization)
  if (result.utterances && result.utterances.length > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("UTTERANCES");
    console.log("-".repeat(60));
    for (const utt of result.utterances) {
      const speaker = utt.speaker || "unknown";
      const start = utt.start || 0;
      const end = utt.end || 0;
      const text = utt.text || "";
      console.log(`[${start.toFixed(2)}s - ${end.toFixed(2)}s] ${speaker}: ${text}`);
    }
  }

  // Word timestamps
  if (result.words && result.words.length > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("WORD TIMESTAMPS");
    console.log("-".repeat(60));
    for (const word of result.words) {
      const start = word.start || 0;
      const end = word.end || 0;
      const text = word.word || "";
      const speaker = word.speaker || "";
      if (speaker) {
        console.log(`[${start.toFixed(2)}s - ${end.toFixed(2)}s] ${speaker}: ${text}`);
      } else {
        console.log(`[${start.toFixed(2)}s - ${end.toFixed(2)}s] ${text}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const textPath = path.join(OUTPUT_DIR, `${audioPath.name}_transcript.txt`);
  fs.writeFileSync(textPath, result.transcription || "", "utf-8");
  console.log(`Saved: ${textPath}`);

  const jsonPath = path.join(OUTPUT_DIR, `${audioPath.name}_result.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Saved: ${jsonPath}`);

  console.log("\nDone!");
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

  const audioPath = path.parse(audioFile);
  console.log(`Reading: ${audioPath.base}`);
  console.log(`Transcribing with language: ${LANGUAGE}`);

  const result = await transcribe(audioFile, apiKey);
  processResponse(result, audioPath);
}

main();
