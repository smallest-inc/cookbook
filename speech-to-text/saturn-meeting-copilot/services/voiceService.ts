/**
 * Voice service — smallest.ai Text-to-Speech integration.
 * Converts insight text to audio using the Waves TTS API.
 */

export interface TTSOptions {
  text: string;
  voiceId?: string;
  speed?: number; // 0.5 – 2.0
}

export interface TTSResult {
  audioBase64: string;
  mimeType: string;
}

const DEFAULT_VOICE = "emily"; // smallest.ai voice ID

/**
 * Synthesize speech using smallest.ai Waves TTS API.
 * Returns base64-encoded audio.
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) throw new Error("SMALLEST_API_KEY is not set");

  const { text, voiceId = DEFAULT_VOICE, speed = 1.0 } = options;

  const response = await fetch("https://waves-api.smallest.ai/api/v1/lightning/get_speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      speed,
      sample_rate: 24000,
      add_wav_header: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`smallest.ai TTS error ${response.status}: ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  return { audioBase64, mimeType: "audio/wav" };
}

/**
 * Stream TTS audio for lower latency (returns a ReadableStream).
 */
export async function streamSpeech(options: TTSOptions): Promise<Response> {
  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) throw new Error("SMALLEST_API_KEY is not set");

  const { text, voiceId = DEFAULT_VOICE, speed = 1.0 } = options;

  return fetch("https://waves-api.smallest.ai/api/v1/lightning/get_speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      speed,
      sample_rate: 24000,
      add_wav_header: true,
    }),
  });
}
