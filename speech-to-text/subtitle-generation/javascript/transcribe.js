#!/usr/bin/env node
/**
 * Smallest AI Speech-to-Text - Subtitle Generation
 *
 * Generate SRT and VTT subtitles from audio or video files.
 * Uses word timestamps to create properly timed subtitle segments.
 *
 * Usage: node transcribe.js <audio_or_video_file>
 *
 * Output:
 * - {filename}.srt - SubRip subtitle file
 * - {filename}.vtt - WebVTT subtitle file
 */

const fs = require("fs");
const path = require("path");

const API_URL = "https://waves-api.smallest.ai/api/v1/lightning/get_text";

const LANGUAGE = "en"; // Use ISO 639-1 codes or "multi" for auto-detect
const WORDS_PER_SEGMENT = 10; // Maximum words per subtitle segment
const MAX_SEGMENT_DURATION = 5.0; // Maximum duration per segment in seconds

async function transcribe(inputFile, apiKey) {
  const fileData = fs.readFileSync(inputFile);

  const params = new URLSearchParams({
    language: LANGUAGE,
    word_timestamps: "true",
  });

  const response = await fetch(`${API_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/octet-stream",
    },
    body: fileData,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function formatTimeSrt(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
}

function formatTimeVtt(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

function createSegments(words) {
  const segments = [];
  let currentSegment = [];
  let segmentStart = null;

  for (const word of words) {
    if (segmentStart === null) {
      segmentStart = word.start || 0;
    }

    currentSegment.push(word);
    const segmentEnd = word.end || 0;
    const segmentDuration = segmentEnd - segmentStart;

    if (currentSegment.length >= WORDS_PER_SEGMENT || segmentDuration >= MAX_SEGMENT_DURATION) {
      segments.push({
        start: segmentStart,
        end: segmentEnd,
        text: currentSegment.map((w) => w.word || "").join(" "),
      });
      currentSegment = [];
      segmentStart = null;
    }
  }

  if (currentSegment.length > 0) {
    segments.push({
      start: segmentStart,
      end: currentSegment[currentSegment.length - 1].end || 0,
      text: currentSegment.map((w) => w.word || "").join(" "),
    });
  }

  return segments;
}

function generateSrt(segments) {
  const lines = [];
  segments.forEach((segment, i) => {
    const start = formatTimeSrt(segment.start);
    const end = formatTimeSrt(segment.end);
    lines.push(`${i + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push("");
  });
  return lines.join("\n");
}

function generateVtt(segments) {
  const lines = ["WEBVTT", ""];
  segments.forEach((segment, i) => {
    const start = formatTimeVtt(segment.start);
    const end = formatTimeVtt(segment.end);
    lines.push(`${i + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push("");
  });
  return lines.join("\n");
}

function processResponse(result, inputPath) {
  if (result.status !== "success") {
    console.error("Error: Transcription failed");
    console.error(result);
    process.exit(1);
  }

  const words = result.words || [];
  if (words.length === 0) {
    console.error("Error: No word timestamps returned. Cannot generate subtitles.");
    process.exit(1);
  }

  const transcription = result.transcription || "";
  console.log(`Transcription: ${transcription.substring(0, 100)}...`);
  console.log(`Words detected: ${words.length}`);

  const segments = createSegments(words);
  console.log(`Subtitle segments: ${segments.length}`);

  const baseName = path.basename(inputPath, path.extname(inputPath));
  const dirName = path.dirname(inputPath);

  const srtContent = generateSrt(segments);
  const srtPath = path.join(dirName, `${baseName}.srt`);
  fs.writeFileSync(srtPath, srtContent, "utf-8");
  console.log(`Saved: ${srtPath}`);

  const vttContent = generateVtt(segments);
  const vttPath = path.join(dirName, `${baseName}.vtt`);
  fs.writeFileSync(vttPath, vttContent, "utf-8");
  console.log(`Saved: ${vttPath}`);

  console.log("\nDone!");
}

async function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.log("Usage: node transcribe.js <audio_or_video_file>");
    process.exit(1);
  }

  const apiKey = process.env.SMALLEST_API_KEY;

  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`Processing: ${path.basename(inputFile)}`);

  const result = await transcribe(inputFile, apiKey);
  processResponse(result, inputFile);
}

main();
