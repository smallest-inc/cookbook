#!/usr/bin/env node
/**
 * Smallest AI Text-to-Speech - Multilingual Translator
 *
 * Generate speech in multiple languages from a single input text.
 * Uses Lightning v3.1 for all supported languages.
 *
 * Usage:
 *   node translate.js "Hello world"
 *   node translate.js "Hello world" --languages hindi spanish
 *
 * Output:
 * - One WAV file per language in a translations/ folder
 */

const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.smallest.ai/waves/v1";
const MODEL = "lightning-v3.1";
const SAMPLE_RATE = 24000;

const LANGUAGES = {
  english: { code: "en", voice: "sophia" },
  hindi:   { code: "hi", voice: "advika" },
  spanish: { code: "es", voice: "camilla" },
  tamil:   { code: "ta", voice: "anitha" },
};

const DEFAULT_LANGUAGES = Object.keys(LANGUAGES);

async function synthesize(text, langConfig, apiKey) {
  const response = await fetch(`${API_BASE}/${MODEL}/get_speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: langConfig.voice,
      language: langConfig.code,
      sample_rate: SAMPLE_RATE,
      output_format: "wav",
    }),
  });

  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const args = process.argv.slice(2);
  const text = args[0];

  if (!text || text === "--help" || text === "-h") {
    console.log('Usage: node translate.js "Text to translate" [--languages hindi spanish ...]');
    console.log(`\nAvailable: ${Object.keys(LANGUAGES).join(", ")}`);
    process.exit(0);
  }

  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  let selected = DEFAULT_LANGUAGES;
  const langIdx = args.indexOf("--languages");
  if (langIdx !== -1) {
    selected = args.slice(langIdx + 1).map((l) => l.toLowerCase());
    const invalid = selected.filter((l) => !LANGUAGES[l]);
    if (invalid.length) {
      console.error(`Unknown language(s): ${invalid.join(", ")}`);
      console.error(`Available: ${Object.keys(LANGUAGES).join(", ")}`);
      process.exit(1);
    }
  }

  const outputDir = "translations";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  console.log(`Text: "${text}"`);
  console.log(`Languages: ${selected.join(", ")}\n`);

  for (const langName of selected) {
    const config = LANGUAGES[langName];
    process.stdout.write(`  ${langName.padEnd(12)} (${config.voice})... `);

    try {
      const audio = await synthesize(text, config, apiKey);
      const filename = path.join(outputDir, `${langName}.wav`);
      fs.writeFileSync(filename, audio);
      console.log(`✓ ${audio.length.toLocaleString()} bytes → ${filename}`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  console.log(`\nDone! Check the ${outputDir}/ folder.`);
}

main();
