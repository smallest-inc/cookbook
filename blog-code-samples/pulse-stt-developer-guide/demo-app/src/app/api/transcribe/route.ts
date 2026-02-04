import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.SMALLEST_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SMALLEST_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    const language = (formData.get('language') as string) || 'en';

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Call Pulse STT API
    const params = new URLSearchParams({
      model: 'pulse',
      language: language,
      word_timestamps: 'true',
      diarize: 'true',
      emotion_detection: 'true'
    });

    const response = await fetch(
      `https://waves-api.smallest.ai/api/v1/pulse/get_text?${params}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': file.type || 'audio/wav'
        },
        body: buffer
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Transcription failed: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
