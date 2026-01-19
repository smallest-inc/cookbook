#!/usr/bin/env node
/**
 * Smallest AI Speech-to-Text - Streaming Transcription
 *
 * Stream an audio file through the WebSocket API and get transcription responses.
 * All transcripts are appended to a text file. Console shows only final transcripts.
 *
 * Usage: node transcribe.js <audio_file>
 *
 * Output:
 * - Console shows final transcripts (is_final=true)
 * - {filename}_responses.txt - All transcripts as plain text
 */

const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const wav = require("wav");

const WS_URL = "wss://waves-api.smallest.ai/api/v1/lightning/get_text";
const OUTPUT_DIR = ".";

// The following are all the features supported by the WebSocket endpoint (Streaming API)
const LANGUAGE = "en";
const ENCODING = "linear16";
const SAMPLE_RATE = 16000;
const WORD_TIMESTAMPS = false;
const FULL_TRANSCRIPT = true;
const SENTENCE_TIMESTAMPS = false;
const DIARIZE = false;
const REDACT_PII = false;
const REDACT_PCI = false;
const NUMERALS = "auto";
const KEYWORDS = [];


async function loadAudio(audioFile) {
  return new Promise((resolve, reject) => {
    const reader = new wav.Reader();
    const chunks = [];

    reader.on("format", (format) => {
      reader.on("data", (chunk) => chunks.push(chunk));
      reader.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);

        // Resample if needed
        if (format.sampleRate !== SAMPLE_RATE) {
          const ratio = format.sampleRate / SAMPLE_RATE;
          const newLength = Math.floor(samples.length / ratio);
          const resampled = new Int16Array(newLength);
          for (let i = 0; i < newLength; i++) {
            resampled[i] = samples[Math.floor(i * ratio)];
          }
          resolve(resampled);
        } else {
          resolve(samples);
        }
      });
    });

    reader.on("error", reject);
    fs.createReadStream(audioFile).pipe(reader);
  });
}


async function transcribe(audioFile, apiKey, onResponse) {
  const params = new URLSearchParams({
    language: LANGUAGE,
    encoding: ENCODING,
    sample_rate: SAMPLE_RATE,
    word_timestamps: WORD_TIMESTAMPS,
    full_transcript: FULL_TRANSCRIPT,
    sentence_timestamps: SENTENCE_TIMESTAMPS,
    diarize: DIARIZE,
    redact_pii: REDACT_PII,
    redact_pci: REDACT_PCI,
    numerals: NUMERALS,
  });

  if (KEYWORDS.length > 0) {
    params.append("keywords", JSON.stringify(KEYWORDS));
  }

  const url = `${WS_URL}?${params}`;
  const audio = await loadAudio(audioFile);
  const chunkDuration = 0.1;
  const chunkSize = Math.floor(chunkDuration * SAMPLE_RATE);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    ws.on("open", async () => {
      for (let i = 0; i < audio.length; i += chunkSize) {
        const chunk = audio.slice(i, i + chunkSize);
        ws.send(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        await new Promise((r) => setTimeout(r, chunkDuration * 1000));
      }
      ws.send(JSON.stringify({ type: "end" }));
    });

    ws.on("message", (data) => {
      const result = JSON.parse(data.toString());
      onResponse(result);
      if (result.is_last) {
        ws.close();
      }
    });

    ws.on("close", resolve);
    ws.on("error", reject);
  });
}


// This function is designed to process feature outputs for all the features supported
// by the WebSocket endpoint (Streaming API)
function processResponse(result, outputFile) {
  const transcript = result.transcript || "";
  if (transcript) {
    fs.appendFileSync(outputFile, transcript + "\n", "utf-8");
  }

  if (result.is_final) {
    if (result.is_last) {
      console.log(`[FINAL] ${transcript}`);

      if (result.full_transcript) {
        console.log("\n" + "=".repeat(60));
        console.log("FULL TRANSCRIPT");
        console.log("=".repeat(60));
        console.log(result.full_transcript);
      }

      // Language
      if (result.language) {
        console.log("\n" + "-".repeat(60));
        console.log("LANGUAGE");
        console.log("-".repeat(60));
        console.log(`Detected: ${result.language}`);
        if (result.languages) {
          console.log(`All: ${JSON.stringify(result.languages)}`);
        }
      }

      // Utterances (speaker diarization)
      if (result.utterances && result.utterances.length > 0) {
        console.log("\n" + "-".repeat(60));
        console.log("UTTERANCES");
        console.log("-".repeat(60));
        for (const utt of result.utterances) {
          const speaker = utt.speaker !== undefined ? utt.speaker : "";
          const start = utt.start || 0;
          const end = utt.end || 0;
          const text = utt.text || "";
          if (speaker !== "") {
            console.log(`[${start.toFixed(2)}s - ${end.toFixed(2)}s] speaker_${speaker}: ${text}`);
          } else {
            console.log(`[${start.toFixed(2)}s - ${end.toFixed(2)}s] ${text}`);
          }
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
          const confidence = word.confidence || 0;
          const speaker = word.speaker !== undefined ? word.speaker : "";
          if (speaker !== "") {
            console.log(`[${start.toFixed(2)}s - ${end.toFixed(2)}s] speaker_${speaker}: ${text} (${confidence.toFixed(2)})`);
          } else {
            console.log(`[${start.toFixed(2)}s - ${end.toFixed(2)}s] ${text} (${confidence.toFixed(2)})`);
          }
        }
      }

      // Redacted entities
      if (result.redacted_entities && result.redacted_entities.length > 0) {
        console.log("\n" + "-".repeat(60));
        console.log("REDACTED ENTITIES");
        console.log("-".repeat(60));
        for (const entity of result.redacted_entities) {
          console.log(`  ${entity}`);
        }
      }

      console.log("\n" + "=".repeat(60));
    } else {
      process.stdout.write(transcript);
    }
  }
}


async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node transcribe.js <audio_file>");
    process.exit(1);
  }

  const audioFile = process.argv[2];
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
  const outputFile = path.join(OUTPUT_DIR, `${audioPath.name}_responses.txt`);

  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  console.log(`Streaming: ${audioPath.base}`);
  console.log(`Responses saved to: ${outputFile}`);
  console.log("-".repeat(60));

  try {
    await transcribe(audioFile, apiKey, (result) => processResponse(result, outputFile));
    console.log("-".repeat(60));
    console.log("Done!");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
