#!/usr/bin/env node
/**
 * Smallest AI Text-to-Speech - Multilingual Translator
 *
 * Generate speech in multiple languages from a single input text.
 * Uses v3.1 for supported languages (highest quality) and falls back to v2.
 *
 * Usage:
 *   node translate.js "Hello world"
 *   node translate.js "Hello world" --languages hindi spanish french
 *
 * Output:
 * - One WAV file per language in a translations/ folder
 */

const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.smallest.ai/waves/v1";
const SAMPLE_RATE = 24000;

const LANGUAGES = {
  english: { code: "en", model: "lightning-v3.1", voice: "sophia" },
  hindi:   { code: "hi", model: "lightning-v3.1", voice: "advika" },
  spanish: { code: "es", model: "lightning-v3.1", voice: "camilla" },
  tamil:   { code: "ta", model: "lightning-v3.1", voice: "anitha" },
  french:  { code: "fr", model: "lightning-v2",   voice: "claire" },
  german:  { code: "de", model: "lightning-v2",   voice: "leon" },
  italian: { code: "it", model: "lightning-v2",   voice: "maria" },
  arabic:  { code: "ar", model: "lightning-v2",   voice: "yasmin" },
  bengali: { code: "bn", model: "lightning-v2",   voice: "biswa" },
  russian: { code: "ru", model: "lightning-v2",   voice: "dmitry" },
  dutch:   { code: "nl", model: "lightning-v2",   voice: "adriana" },
  polish:  { code: "pl", model: "lightning-v2",   voice: "lukas" },
};

const DEFAULT_LANGUAGES = ["english", "hindi", "spanish", "french", "german"];

async function synthesize(text, langConfig, apiKey) {
  const response = await fetch(`${API_BASE}/${langConfig.model}/get_speech`, {
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
    console.log('Usage: node translate.js "Text to translate" [--languages hindi spanish french ...]');
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
    process.stdout.write(`  ${langName.padEnd(12)} (${config.model}, ${config.voice})... `);

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
