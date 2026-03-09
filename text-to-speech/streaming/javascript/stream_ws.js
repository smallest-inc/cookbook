#!/usr/bin/env node
/**
 * Smallest AI Text-to-Speech - WebSocket Streaming
 *
 * Stream audio in real-time via WebSocket. Supports bidirectional communication
 * for real-time conversations and LLM pipelines.
 *
 * Usage: node stream_ws.js "Text to stream"
 *
 * Requires: npm install ws
 *
 * Output:
 * - WAV audio file (streamed_ws_output.wav)
 * - Latency metrics printed to console
 */

const fs = require("fs");
const WebSocket = require("ws");

const MODEL = "lightning-v3.1";
const VOICE_ID = "sophia";
const SAMPLE_RATE = 24000;
const SPEED = 1.0;

const WS_URL = `wss://api.smallest.ai/waves/v1/${MODEL}/get_speech/stream`;

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
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

function streamSpeech(text, apiKey) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let firstChunkTime = null;
    const chunks = [];
    let chunkCount = 0;

    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          text,
          voice_id: VOICE_ID,
          sample_rate: SAMPLE_RATE,
          speed: SPEED,
        })
      );
    });

    ws.on("message", (raw) => {
      const data = JSON.parse(raw.toString());

      if (data.status === "error") {
        ws.close();
        reject(new Error(`WebSocket error: ${data.error?.message || JSON.stringify(data)}`));
        return;
      }

      if (data.status === "complete") {
        ws.close();

        const totalTime = Date.now() - startTime;
        const pcmData = Buffer.concat(chunks);

        console.log(`  Total chunks: ${chunkCount}`);
        console.log(`  Total time: ${totalTime}ms`);
        console.log(`  Audio size: ${pcmData.length.toLocaleString()} bytes`);

        resolve(addWavHeader(pcmData, SAMPLE_RATE));
        return;
      }

      if (data.status === "chunk") {
        const audioBytes = Buffer.from(data.data.audio, "base64");
        chunks.push(audioBytes);
        chunkCount++;

        if (firstChunkTime === null) {
          firstChunkTime = Date.now();
          console.log(`  Time to first byte: ${firstChunkTime - startTime}ms`);
        }
      }
    });

    ws.on("error", reject);
  });
}

async function main() {
  const text = process.argv[2];

  if (!text) {
    console.log('Usage: node stream_ws.js "Text to stream"');
    process.exit(1);
  }

  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    console.error("Error: SMALLEST_API_KEY environment variable not set");
    process.exit(1);
  }

  console.log(`Streaming with WebSocket (${MODEL}, ${VOICE_ID})...`);
  const wavData = await streamSpeech(text, apiKey);

  const outputFile = "streamed_ws_output.wav";
  fs.writeFileSync(outputFile, wavData);
  console.log(`  Saved to ${outputFile}`);
}

main();
