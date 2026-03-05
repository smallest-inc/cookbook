#!/usr/bin/env node
/**
 * Smallest AI Text-to-Speech - SSE Streaming
 *
 * Stream audio in real-time via Server-Sent Events (SSE). Audio chunks arrive
 * as they're generated, enabling low-latency playback.
 *
 * Usage: node stream_sse.js "Text to stream"
 *
 * Output:
 * - WAV audio file (streamed_output.wav)
 * - Latency metrics printed to console
 */

const fs = require("fs");

const MODEL = "lightning-v3.1";
const VOICE_ID = "sophia";
const SAMPLE_RATE = 24000;
const SPEED = 1.0;

const API_BASE = "https://api.smallest.ai/waves/v1";

function addWavHeader(pcmData, sampleRate, channels = 1, bitsPerSample = 16) {
  const dataSize = pcmData.length;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

async function streamSpeech(text, apiKey) {
  const startTime = Date.now();
  let firstChunkTime = null;
  const chunks = [];
  let chunkCount = 0;

  const response = await fetch(`${API_BASE}/${MODEL}/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: VOICE_ID,
      sample_rate: SAMPLE_RATE,
      speed: SPEED,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `API request failed (${response.status}): ${await response.text()}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;

      const payload = JSON.parse(line.slice(5).trim());

      if (payload.done) break;
      if (!payload.audio) continue;

      const audioBytes = Buffer.from(payload.audio, "base64");
      chunks.push(audioBytes);
      chunkCount++;

      if (firstChunkTime === null) {
        firstChunkTime = Date.now();
        console.log(`  Time to first byte: ${firstChunkTime - startTime}ms`);
      }
    }
  }

  const totalTime = Date.now() - startTime;
  const pcmData = Buffer.concat(chunks);

  console.log(`  Total chunks: ${chunkCount}`);
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Audio size: ${pcmData.length.toLocaleString()} bytes`);

  return addWavHeader(pcmData, SAMPLE_RATE);
}

async function main() {
  const text = process.argv[2];

  if (!text) {
    console.log('Usage: node stream_sse.js "Text to stream"');
    process.exit(1);
  }

  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  console.log(`Streaming with SSE (${MODEL}, ${VOICE_ID})...`);
  const wavData = await streamSpeech(text, apiKey);

  const outputFile = "streamed_output.wav";
  fs.writeFileSync(outputFile, wavData);
  console.log(`  Saved to ${outputFile}`);
}

main();
