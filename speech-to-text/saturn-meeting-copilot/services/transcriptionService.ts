/**
 * Transcription service — smallest.ai Pulse STT (HTTP POST).
 * POST https://api.smallest.ai/waves/v1/pulse/get_text
 */

export interface TranscriptionSegment {
  text: string;
  speaker?: string;
  startTime: number;
  endTime: number;
  confidence: number;
  words?: Array<{ text: string; start: number; end: number; confidence: number }>;
}

export interface TranscriptionResponse {
  segments: TranscriptionSegment[];
  fullText: string;
  language?: string;
}

/**
 * Transcribe an audio buffer using smallest.ai Pulse STT.
 * Sends raw audio bytes with the appropriate Content-Type header.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/webm",
  language = "en"
): Promise<TranscriptionResponse> {
  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) throw new Error("SMALLEST_API_KEY is not set");

  const response = await fetch(
    `https://api.smallest.ai/waves/v1/pulse/get_text?language=${encodeURIComponent(language)}&word_timestamps=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": mimeType,
      },
      body: audioBuffer as unknown as BodyInit,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    const err = new Error(`smallest.ai STT error ${response.status}: ${error}`);
    // Tag billing errors so the route can forward the correct HTTP status
    if (response.status === 402 || response.status === 403) {
      (err as Error & { billingError: boolean }).billingError = true;
    }
    throw err;
  }

  const data = await response.json();
  console.log("[transcriptionService] raw response:", JSON.stringify(data));

  // Response: { status, transcription, words: [{start,end,word}], utterances: [{start,end,text}] }
  const utterances: Array<{ start: number; end: number; text: string }> =
    data.utterances ?? [];

  const segments: TranscriptionSegment[] = utterances.length
    ? utterances.map((u) => ({
        text: u.text.trim(),
        startTime: u.start,
        endTime: u.end,
        confidence: 0.9,
        words: (data.words ?? [])
          .filter((w: { start: number }) => w.start >= u.start && w.start < u.end)
          .map((w: { word: string; start: number; end: number }) => ({
            text: w.word,
            start: w.start,
            end: w.end,
            confidence: 0.9,
          })),
      }))
    : data.transcription?.trim()
    ? [{ text: data.transcription.trim(), startTime: 0, endTime: 0, confidence: 0.9 }]
    : [];

  return {
    segments,
    fullText: data.transcription ?? segments.map((s) => s.text).join(" "),
    language: data.language,
  };
}
