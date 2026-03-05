# Voice Gallery Web App

A beautiful web app to browse, filter, and preview all Smallest AI voices. Type any text, pick a voice, hear it instantly.

**[Deploy to Vercel](#deploy) in 30 seconds.**

## Features

- Browse 80+ voices with language, gender, and accent filters
- Type custom text and generate speech instantly
- Play/download generated audio
- Responsive design — works on mobile

## Deploy

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/smallest-inc/cookbook/tree/main/text-to-speech/voice-gallery-app&env=SMALLEST_API_KEY&envDescription=Get%20your%20API%20key%20at%20app.smallest.ai&project-name=smallest-voice-gallery)

Or manually:

```bash
cd text-to-speech/voice-gallery-app
npm install
echo "SMALLEST_API_KEY=your-key" > .env.local
npm run dev
```

### Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template)

```bash
npm install
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SMALLEST_API_KEY` | Your API key from [app.smallest.ai](https://app.smallest.ai/dashboard/settings/apikeys) |

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Smallest AI Lightning TTS v3.1 API
