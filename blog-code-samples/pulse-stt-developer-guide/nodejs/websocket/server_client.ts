/**
 * Real-time STT Streaming Client (Node.js/TypeScript)
 *
 * Streams a WAV file to Pulse STT WebSocket API and displays transcripts.
 *
 * Usage:
 *   npx ts-node server_client.ts path/to/audio.wav
 *   npx ts-node server_client.ts audio.wav --language hi
 *
 * Requirements:
 *   npm install ws typescript ts-node @types/ws @types/node
 *
 * Note: WebSocket API requires Enterprise subscription.
 */

import WebSocket from 'ws';
import fs from 'fs';

interface ASRResponse {
  session_id?: string;
  transcript?: string;
  full_transcript?: string;
  is_final?: boolean;
  is_last?: boolean;
  language?: string;
  status?: string;
  message?: string;
}

class PulseStreamingClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private language: string;
  private sampleRate: number;

  constructor(
    apiKey: string,
    language: string = 'en',
    sampleRate: number = 16000
  ) {
    this.apiKey = apiKey;
    this.language = language;
    this.sampleRate = sampleRate;
  }

  private buildUrl(): string {
    const params = new URLSearchParams({
      language: this.language,
      encoding: 'linear16',
      sample_rate: this.sampleRate.toString(),
      word_timestamps: 'true',
      full_transcript: 'true'
    });

    return `wss://waves-api.smallest.ai/api/v1/pulse/get_text?${params}`;
  }

  async connect(
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.buildUrl(), {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });

      this.ws.on('open', () => {
        console.log('✅ Connected to Pulse STT');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const response: ASRResponse = JSON.parse(data.toString());

          if (response.status === 'error') {
            const msg = response.message || 'Unknown error';
            if (!msg.toLowerCase().includes('timed out')) {
              console.error('❌ API Error:', msg);
            }
            return;
          }

          if (response.transcript) {
            onTranscript(response.transcript, response.is_final || false);
          }
        } catch (err) {
          console.error('❌ Parse error:', err);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 Connection closed: ${code}`);
      });
    });
  }

  sendAudio(audioChunk: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioChunk);
    }
  }

  sendEnd(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end' }));
    }
  }

  async streamFile(filePath: string): Promise<string[]> {
    const transcripts: string[] = [];

    await this.connect((text, isFinal) => {
      if (isFinal) {
        transcripts.push(text);
        console.log(`\n✅ ${text}`);
      } else {
        process.stdout.write(`\r⏳ ${text}...`);
      }
    });

    console.log(`📁 Streaming: ${filePath}\n`);

    // Read file (assuming WAV with 44-byte header)
    const audioBuffer = fs.readFileSync(filePath);
    const audioData = audioBuffer.slice(44); // Skip WAV header

    const chunkSize = 3200; // ~100ms of 16kHz 16-bit audio

    for (let i = 0; i < audioData.length; i += chunkSize) {
      const chunk = audioData.slice(i, i + chunkSize);
      this.sendAudio(chunk);

      // Simulate real-time streaming pace
      await new Promise(r => setTimeout(r, 50));
    }

    // Signal end of audio
    this.sendEnd();

    // Wait for final transcripts
    await new Promise(r => setTimeout(r, 3000));
    this.close();

    return transcripts;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx ts-node server_client.ts <audio.wav> [--language <code>]');
    process.exit(1);
  }

  const filePath = args[0];
  let language = 'en';

  const langIndex = args.indexOf('--language');
  if (langIndex !== -1 && args[langIndex + 1]) {
    language = args[langIndex + 1];
  }

  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    console.error('❌ SMALLEST_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('🎙️  Pulse STT Real-time Streaming');
  console.log('='.repeat(60));
  console.log(`🌐 Language: ${language}`);
  console.log();

  try {
    const client = new PulseStreamingClient(apiKey, language, 16000);
    const transcripts = await client.streamFile(filePath);

    console.log();
    console.log('='.repeat(60));
    console.log('📝 FULL TRANSCRIPT');
    console.log('='.repeat(60));
    console.log(transcripts.join(' ') || '(no speech detected)');

  } catch (error: any) {
    if (error.message && error.message.includes('403')) {
      console.error('❌ HTTP 403 - WebSocket STT requires Enterprise subscription');
    } else {
      console.error(`❌ Error: ${error.message || error}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
