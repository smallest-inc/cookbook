#!/usr/bin/env node
/**
 * Smallest AI Text-to-Speech - Pronunciation Dictionaries
 *
 * Create custom pronunciation dictionaries and use them when generating speech.
 * Useful for names, acronyms, and domain-specific terms.
 *
 * Usage: node pronunciation.js
 *
 * Output:
 * - Two WAV files: one without and one with custom pronunciation
 */

const fs = require("fs");

const MODEL = "lightning-v3.1";
const VOICE_ID = "sophia";
const SAMPLE_RATE = 24000;
const API_BASE = "https://api.smallest.ai/waves/v1";

const SAMPLE_TEXT =
  "The Smallest API lets you build voice AI. Ask Diya about GIF support in the SDK.";

const CUSTOM_PRONUNCIATIONS = [
  { word: "API", pronunciation: "ay pee eye" },
  { word: "Diya", pronunciation: "dee-yah" },
  { word: "GIF", pronunciation: "jiff" },
  { word: "SDK", pronunciation: "ess dee kay" },
];

async function createDict(apiKey) {
  const response = await fetch(`${API_BASE}/pronunciation-dicts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items: CUSTOM_PRONUNCIATIONS }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create dict (${response.status}): ${await response.text()}`
    );
  }

  const data = await response.json();
  console.log(`Created pronunciation dict: ${data.id}`);
  for (const item of CUSTOM_PRONUNCIATIONS) {
    console.log(`  ${item.word} → ${item.pronunciation}`);
  }
  return data.id;
}

async function listDicts(apiKey) {
  const response = await fetch(`${API_BASE}/pronunciation-dicts`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to list dicts (${response.status}): ${await response.text()}`
    );
  }

  const dicts = await response.json();
  console.log(`\nYou have ${dicts.length} pronunciation dict(s)`);
  for (const d of dicts) {
    console.log(`  ID: ${d.id} — ${d.items.length} entries`);
  }
}

async function synthesize(text, apiKey, pronunciationDicts) {
  const payload = {
    text,
    voice_id: VOICE_ID,
    sample_rate: SAMPLE_RATE,
    output_format: "wav",
  };
  if (pronunciationDicts) {
    payload.pronunciation_dicts = pronunciationDicts;
  }

  const response = await fetch(`${API_BASE}/${MODEL}/get_speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Synthesis failed (${response.status}): ${await response.text()}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function deleteDict(dictId, apiKey) {
  const response = await fetch(`${API_BASE}/pronunciation-dicts`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: dictId }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to delete dict (${response.status}): ${await response.text()}`
    );
  }

  console.log(`\nDeleted pronunciation dict: ${dictId}`);
}

async function main() {
  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  console.log(`Text: "${SAMPLE_TEXT}"\n`);

  console.log("Generating without custom pronunciation...");
  const audioDefault = await synthesize(SAMPLE_TEXT, apiKey);
  fs.writeFileSync("output_default.wav", audioDefault);
  console.log(
    `  Saved to output_default.wav (${audioDefault.length.toLocaleString()} bytes)`
  );

  console.log();
  const dictId = await createDict(apiKey);

  await listDicts(apiKey);

  console.log("\nGenerating with custom pronunciation...");
  const audioCustom = await synthesize(SAMPLE_TEXT, apiKey, [dictId]);
  fs.writeFileSync("output_custom.wav", audioCustom);
  console.log(
    `  Saved to output_custom.wav (${audioCustom.length.toLocaleString()} bytes)`
  );

  await deleteDict(dictId, apiKey);

  console.log("\nDone! Compare the two files:");
  console.log("  output_default.wav — default pronunciation");
  console.log("  output_custom.wav  — custom pronunciation");
}

main();
