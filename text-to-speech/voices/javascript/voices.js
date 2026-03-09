#!/usr/bin/env node
/**
 * Smallest AI Text-to-Speech - Voice Explorer
 *
 * List available TTS voices, filter by language/gender/accent, and preview any voice.
 *
 * Usage:
 *   node voices.js                             # List all voices
 *   node voices.js --language english          # Filter by language
 *   node voices.js --gender female             # Filter by gender
 *   node voices.js --preview sophia             # Generate preview for a voice
 *
 * Output:
 * - Table of available voices
 * - Optional preview WAV file
 */

const fs = require("fs");

const MODEL = "lightning-v3.1";
const API_BASE = "https://api.smallest.ai/waves/v1";
const PREVIEW_TEXT =
  "Hello! This is a preview of my voice. I can speak naturally with great clarity and expression.";

function parseArgs(argv) {
  const args = { model: MODEL };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--model" && argv[i + 1]) args.model = argv[++i];
    else if (argv[i] === "--language" && argv[i + 1]) args.language = argv[++i];
    else if (argv[i] === "--gender" && argv[i + 1]) args.gender = argv[++i];
    else if (argv[i] === "--accent" && argv[i + 1]) args.accent = argv[++i];
    else if (argv[i] === "--preview" && argv[i + 1]) args.preview = argv[++i];
  }
  return args;
}

async function getVoices(apiKey, model) {
  const response = await fetch(`${API_BASE}/${model}/get_voices`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed (${response.status}): ${await response.text()}`
    );
  }

  const data = await response.json();
  return data.voices || data;
}

function filterVoices(voices, { language, gender, accent }) {
  let filtered = voices;
  if (language) {
    filtered = filtered.filter((v) =>
      (v.tags?.language || []).some(
        (l) => l.toLowerCase() === language.toLowerCase()
      )
    );
  }
  if (gender) {
    filtered = filtered.filter(
      (v) => (v.tags?.gender || "").toLowerCase() === gender.toLowerCase()
    );
  }
  if (accent) {
    filtered = filtered.filter((v) =>
      (v.tags?.accent || "").toLowerCase().includes(accent.toLowerCase())
    );
  }
  return filtered;
}

function printVoices(voices) {
  if (!voices.length) {
    console.log("No voices found matching your criteria.");
    return;
  }

  console.log("");
  console.log(
    "Voice ID".padEnd(20) +
      "Name".padEnd(20) +
      "Gender".padEnd(10) +
      "Languages".padEnd(25) +
      "Accent"
  );
  console.log("-".repeat(90));

  for (const v of voices) {
    const tags = v.tags || {};
    console.log(
      (v.voiceId || "").padEnd(20) +
        (v.displayName || "").padEnd(20) +
        (tags.gender || "—").padEnd(10) +
        (tags.language || []).join(", ").padEnd(25) +
        (tags.accent || "—")
    );
  }

  console.log(`\nTotal: ${voices.length} voice(s)`);
}

async function previewVoice(voiceId, apiKey, model) {
  console.log(`Generating preview for '${voiceId}'...`);

  const response = await fetch(`${API_BASE}/${model}/get_speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: PREVIEW_TEXT,
      voice_id: voiceId,
      sample_rate: 24000,
      speed: 1.0,
      output_format: "wav",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `API request failed (${response.status}): ${await response.text()}`
    );
  }

  const audio = Buffer.from(await response.arrayBuffer());
  const filename = `preview_${voiceId}.wav`;
  fs.writeFileSync(filename, audio);
  console.log(`Saved to ${filename} (${audio.length.toLocaleString()} bytes)`);
}

async function main() {
  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  const args = parseArgs(process.argv);

  if (args.preview) {
    await previewVoice(args.preview, apiKey, args.model);
    return;
  }

  const voices = await getVoices(apiKey, args.model);
  const filtered = filterVoices(voices, args);
  printVoices(filtered);
}

main();
