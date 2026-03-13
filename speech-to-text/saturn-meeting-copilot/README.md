# Saturn — AI Meeting Intelligence

Saturn is a real-time AI meeting copilot. It transcribes your calls, detects questions, searches the web for answers, and generates a full meeting summary with action items when you're done.

---

## What it does

- **Live transcription** — captures your mic via Smallest.ai (falls back to browser speech if needed)
- **Google Meet integration** — Chrome extension reads live captions or tab audio from any Meet call
- **Auto research** — detects questions in conversation and searches Exa for answers in real time
- **AI insights** — Claude synthesizes clean answers shown in a side panel
- **Push-to-talk search** — hold `Tab` and speak to search anything directly
- **Meeting summary** — Claude writes a full summary, decisions, and action items when the meeting ends

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd Saturn
npm install
```

### 2. Add your API keys

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in your keys:

```env
# Smallest.ai — Speech-to-Text (required for mic transcription)
# Get your key at: https://waves.smallest.ai
SMALLEST_API_KEY=your_key_here

# Exa — Semantic web search (required for AI research)
# Get your key at: https://exa.ai
EXA_API_KEY=your_key_here

# Anthropic — Claude for summarization and meeting notes (required)
# Get your key at: https://console.anthropic.com
ANTHROPIC_API_KEY=your_key_here

# App config (leave as-is for local dev)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

| Key | Where to get it | Used for |
|-----|----------------|----------|
| `SMALLEST_API_KEY` | [waves.smallest.ai](https://waves.smallest.ai) | Mic → text transcription |
| `EXA_API_KEY` | [exa.ai](https://exa.ai) | Web search for questions |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | AI summaries & insights |

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Google Meet Extension (optional but recommended)

The Chrome extension lets Saturn hear **all participants** in a Google Meet call — not just your mic.

### Install

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extensions/google-meet/` folder from this repo

### Use

1. Join a Google Meet call
2. Click the **Saturn** icon in your Chrome toolbar
3. Click **Side Panel ⊞** — Saturn opens as a sidebar alongside Meet
4. Enable **CC (captions)** in Google Meet for best results (all participants captured)
5. Saturn auto-starts when it hears the first word

> **Tip:** Enabling Google Meet's live captions (CC button in the Meet toolbar) switches the extension to caption mode, which captures every participant and doesn't need Smallest.ai at all.

---

## How to use

| Action | How |
|--------|-----|
| Start a meeting | Click **Start Meeting** on the landing page |
| Ask a question | Just speak — Saturn detects `?` or question words and auto-researches |
| Manual search | Hold `Tab` + speak → release to search |
| View insights | AI Insights panel on the right (or full-width in the side panel) |
| End meeting | Click **Stop** — Claude generates your meeting notes automatically |

---

## Project structure

```
Saturn/
├── app/
│   ├── api/
│   │   ├── research/      # Exa search + Claude summarization
│   │   ├── summary/       # End-of-meeting Claude summary
│   │   ├── transcribe/    # Smallest.ai STT endpoint
│   │   └── transcript/    # SSE stream + push endpoint
│   └── page.tsx           # Main app page
├── components/
│   ├── controls/          # BottomBar with push-to-talk
│   ├── insights/          # AI Insights panel + cards
│   └── transcript/        # Live transcript panel
├── extensions/
│   └── google-meet/       # Chrome extension (MV3)
├── hooks/
│   ├── useExaBot.ts       # Auto question detection + research
│   ├── useDirectSearch.ts # Push-to-talk Tab search
│   └── useGoogleMeetTranscript.ts  # SSE + mic capture
├── services/
│   └── researchAgent.ts   # Question detection logic
└── store/
    └── meetingStore.ts    # Zustand state
```

---

## Requirements

- Node.js 18+
- Chrome (for the extension)
- Microphone access
