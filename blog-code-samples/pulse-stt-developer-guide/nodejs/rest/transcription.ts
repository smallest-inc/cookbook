/**
 * Audio Transcription with Pulse STT REST API (TypeScript)
 *
 * Usage:
 *   npx ts-node transcription.ts path/to/audio.wav
 *   npx ts-node transcription.ts audio.mp3 --language es
 *
 * Requirements:
 *   npm install typescript ts-node @types/node
 */

import fs from 'fs';
import path from 'path';

interface TranscriptionWord {
  start: number;
  end: number;
  word: string;
}

interface Utterance {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResponse {
  status: string;
  transcription: string;
  words?: TranscriptionWord[];
  utterances?: Utterance[];
  metadata?: {
    duration: number;
    fileSize: number;
  };
}

async function transcribeAudioFile(
  filePath: string,
  language: string = 'en'
): Promise<TranscriptionResponse> {
  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    throw new Error('SMALLEST_API_KEY environment variable not set');
  }

  const audioBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const contentTypes: Record<string, string> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm'
  };

  const params = new URLSearchParams({
    model: 'pulse',
    language: language,
    word_timestamps: 'true'
  });

  console.log(`📁 File: ${filePath}`);
  console.log(`🌐 Language: ${language}`);
  console.log();

  const response = await fetch(
    `https://waves-api.smallest.ai/api/v1/pulse/get_text?${params}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': contentTypes[ext] || 'audio/wav'
      },
      body: audioBuffer
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json() as TranscriptionResponse;
}

async function transcribeWithRetry(
  filePath: string,
  language: string = 'en',
  maxRetries: number = 3
): Promise<TranscriptionResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeAudioFile(filePath, language);
    } catch (error) {
      lastError = error as Error;

      // Don't retry auth errors
      if (error instanceof Error && error.message.includes('401')) {
        throw error;
      }

      // Exponential backoff for rate limits
      if (error instanceof Error && error.message.includes('429')) {
        const delay = 1000 * Math.pow(2, attempt);
        console.log(`⏳ Rate limited, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (attempt < maxRetries) {
        console.log(`⚠️  Attempt ${attempt} failed, retrying...`);
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError || new Error('Transcription failed after retries');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx ts-node transcription.ts <audio_file> [--language <code>]');
    process.exit(1);
  }

  const filePath = args[0];
  let language = 'en';

  const langIndex = args.indexOf('--language');
  if (langIndex !== -1 && args[langIndex + 1]) {
    language = args[langIndex + 1];
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const result = await transcribeWithRetry(filePath, language);

    console.log('='.repeat(60));
    console.log('📝 TRANSCRIPTION');
    console.log('='.repeat(60));
    console.log(result.transcription || '(no transcription)');
    console.log();

    if (result.words && result.words.length > 0) {
      console.log('='.repeat(60));
      console.log('⏱️  WORD TIMESTAMPS');
      console.log('='.repeat(60));
      for (const word of result.words) {
        console.log(`  [${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s] ${word.word}`);
      }
    }

    if (result.metadata) {
      console.log();
      console.log(`📊 Duration: ${result.metadata.duration}s`);
      console.log(`📊 File size: ${result.metadata.fileSize} bytes`);
    }

  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

main();
