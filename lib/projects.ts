import { Project } from "./types";

const GITHUB_BASE =
  "https://github.com/smallest-inc/cookbook/tree/main";

export const projects: Project[] = [
  // ─── FEATURED ─────────────────────────────────────────
  {
    slug: "jarvis-voice-assistant",
    title: "Jarvis Voice Assistant",
    description:
      "Always-on assistant with wake word detection, LLM reasoning, and real-time speech synthesis.",
    longDescription:
      'Jarvis is a fully local voice assistant that listens for a wake word ("Jarvis"), transcribes your speech with Pulse STT via WebSocket, reasons with an LLM (Groq), and speaks back using Lightning TTS. It runs continuously and demonstrates real-time, low-latency voice interaction.',
    category: "speech-to-text",
    tags: ["websocket", "wake-word", "llm", "tts", "real-time"],
    difficulty: "advanced",
    status: "code-only",
    featured: true,
    cookbookPath: "speech-to-text/websocket/jarvis",
    githubUrl: `${GITHUB_BASE}/speech-to-text/websocket/jarvis`,
    techStack: ["Python", "WebSocket", "Groq", "Lightning TTS"],
    apiProducts: ["pulse-stt", "lightning-tts"],
    features: [
      "Wake word detection ('Jarvis')",
      "Real-time WebSocket transcription",
      "LLM reasoning via Groq",
      "Text-to-speech response with Lightning TTS",
      "Continuous listening loop",
    ],
    audioSamples: [],
  },
  {
    slug: "emotion-analyzer",
    title: "Emotion Analyzer",
    description:
      "Visualize speaker emotions across a conversation with interactive charts and real-time analysis.",
    longDescription:
      "Upload an audio file and watch as Pulse STT transcribes it while detecting emotions for each speaker segment. The frontend renders interactive charts showing emotional arcs over time — anger, joy, sadness, and more.",
    category: "speech-to-text",
    tags: ["emotions", "visualization", "diarization", "web-app"],
    difficulty: "intermediate",
    status: "demo",
    featured: true,
    cookbookPath: "speech-to-text/emotion-analyzer",
    githubUrl: `${GITHUB_BASE}/speech-to-text/emotion-analyzer`,
    // gifUrl available when demo is deployed
    techStack: ["Python", "Flask", "JavaScript", "Chart.js"],
    apiProducts: ["pulse-stt"],
    features: [
      "Emotion detection per speaker segment",
      "Interactive emotion timeline charts",
      "Speaker diarization",
      "Support for multiple audio formats",
    ],
  },
  {
    slug: "atoms-sdk-web-agent",
    title: "Multi-Agent Voice AI Dashboard",
    description:
      "Real-time dashboard with specialized voice agents for gaming, news, and weather — powered by Atoms SDK.",
    longDescription:
      "A Next.js web application showcasing the Atoms SDK Web integration. Features multiple specialized agents: a Tic-Tac-Toe game agent, a Hacker News reader, and a weather agent. Each agent demonstrates different capabilities of the Atoms platform including tool calling, real-time state updates, and voice interaction.",
    category: "voice-agents",
    tags: ["next.js", "web-sdk", "multi-agent", "dashboard", "real-time"],
    difficulty: "advanced",
    status: "demo",
    featured: true,
    cookbookPath: "voice-agents/atoms_sdk_web_agent",
    githubUrl: `${GITHUB_BASE}/voice-agents/atoms_sdk_web_agent`,
    demoUrl: "https://agent-smallest-ai.vercel.app",
    techStack: ["Next.js", "TypeScript", "Atoms SDK", "Tailwind CSS"],
    apiProducts: ["atoms"],
    features: [
      "Multiple specialized voice agents",
      "Tic-Tac-Toe game with voice control",
      "Hacker News voice reader",
      "Weather agent with real-time data",
      "Wave avatar animation",
    ],
    tryItConfig: {
      type: "agent",
      placeholder: "Enter your Atoms agent ID to try...",
    },
  },
  {
    slug: "bank-csr",
    title: "Bank Customer Service Agent",
    description:
      "Full banking voice agent with SQL queries, identity verification, FD management, and audit logging.",
    longDescription:
      "A comprehensive banking customer service agent that handles account inquiries, fixed deposit operations, fund transfers, and identity verification. Demonstrates multi-round tool chaining, SQL database queries, and audit logging — all via voice.",
    category: "voice-agents",
    tags: ["banking", "sql", "verification", "audit", "tools"],
    difficulty: "advanced",
    status: "code-only",
    featured: true,
    cookbookPath: "voice-agents/bank_csr",
    githubUrl: `${GITHUB_BASE}/voice-agents/bank_csr`,
    techStack: ["Python", "Atoms SDK", "SQLite", "Loguru"],
    apiProducts: ["atoms"],
    features: [
      "Identity verification via OTP",
      "Account balance and transaction queries",
      "Fixed deposit management",
      "Fund transfers between accounts",
      "Complete audit logging",
      "Multi-round tool chaining",
    ],
  },

  // ─── TEXT-TO-SPEECH ──────────────────────────────────
  {
    slug: "getting-started-tts",
    title: "Getting Started with TTS",
    description:
      "Generate speech from text in seconds — sync and async examples in Python and JavaScript.",
    longDescription:
      "The simplest way to start with Smallest AI's Lightning TTS. Includes synchronous and asynchronous synthesis in Python, plus a Node.js REST example. Generate WAV files, customize voice and speed, and integrate TTS into your apps.",
    category: "text-to-speech",
    tags: ["beginner", "python", "javascript", "sync", "async"],
    difficulty: "beginner",
    status: "code-only",
    cookbookPath: "text-to-speech/getting-started",
    githubUrl: `${GITHUB_BASE}/text-to-speech/getting-started`,
    techStack: ["Python", "JavaScript", "Smallest SDK"],
    apiProducts: ["lightning-tts"],
    features: [
      "Synchronous text-to-speech synthesis",
      "Async batch generation with concurrency",
      "Node.js REST API integration",
      "Configurable voice, speed, and sample rate",
    ],
    audioSamples: [
      { label: "Ashley — Welcome (1.0x)", src: "/audio-samples/ashley-welcome.wav" },
      { label: "Eleanor — Fast delivery (1.3x)", src: "/audio-samples/eleanor-fast.wav" },
      { label: "Julian — Slow narration (0.85x)", src: "/audio-samples/julian-narration.wav" },
    ],
  },
  {
    slug: "multi-voice-showcase",
    title: "Multi-Voice TTS Showcase",
    description:
      "Hear the full range of Lightning TTS — multiple voices, speeds, and speaking styles side by side.",
    longDescription:
      "Generate speech samples across different voices and speaking speeds to demonstrate the range of Lightning TTS. All samples are generated concurrently using async synthesis, showcasing batch TTS workflows. Perfect for voice previews, content demos, and comparing different voice characters.",
    category: "text-to-speech",
    tags: ["voices", "speed", "batch", "comparison", "showcase"],
    difficulty: "beginner",
    status: "demo",
    featured: true,
    cookbookPath: "text-to-speech/multi-voice-showcase",
    githubUrl: `${GITHUB_BASE}/text-to-speech/multi-voice-showcase`,
    techStack: ["Python", "Smallest SDK", "asyncio"],
    apiProducts: ["lightning-tts"],
    features: [
      "Multiple voice characters (Ashley, Ryan, Eleanor, Julian, Shivangi)",
      "Speed comparison (0.85x to 1.3x)",
      "Concurrent async batch generation",
      "Showcase-ready audio output",
    ],
    audioSamples: [
      { label: "Ashley — Welcome", src: "/audio-samples/ashley-welcome.wav" },
      { label: "Ryan — Introduction", src: "/audio-samples/ryan-intro.wav" },
      { label: "Eleanor — Fast delivery (1.3x)", src: "/audio-samples/eleanor-fast.wav" },
      { label: "Julian — Narration (0.85x)", src: "/audio-samples/julian-narration.wav" },
      { label: "Shivangi — Hindi demo", src: "/audio-samples/shivangi-hindi.wav" },
    ],
  },

  {
    slug: "tts-playground",
    title: "TTS Playground",
    description:
      "Try Lightning TTS live — type any text, pick a voice, and generate speech instantly with your API key.",
    longDescription:
      "An interactive playground for Smallest AI's Lightning v2 TTS. Choose from 90+ voices across 16 languages, adjust speed from 0.5x to 2.0x, and hear your text spoken aloud in real time. Just enter your API key and start generating — no code needed. Download the generated audio as WAV files.",
    category: "text-to-speech",
    tags: ["playground", "interactive", "live-demo", "voices", "multilingual"],
    difficulty: "beginner",
    status: "live",
    featured: true,
    cookbookPath: "text-to-speech/getting-started",
    githubUrl: `${GITHUB_BASE}/text-to-speech/getting-started`,
    techStack: ["Lightning v2", "90+ Voices", "16 Languages", "REST API"],
    apiProducts: ["lightning-tts"],
    features: [
      "90+ voices across 16 languages",
      "Adjustable speed (0.5x to 2.0x)",
      "Real-time speech generation",
      "Download generated audio as WAV",
      "Bring your own API key",
      "Code-switching support (Hindi + English)",
    ],
    tryItConfig: {
      type: "tts",
      placeholder: "Type text and generate speech...",
      sampleInput:
        "Welcome to Smallest AI! Our Lightning TTS generates natural speech in real time.",
    },
  },

  // ─── SPEECH-TO-TEXT ───────────────────────────────────
  {
    slug: "getting-started-stt",
    title: "Getting Started with STT",
    description:
      "The simplest way to transcribe audio — basic REST API transcription in Python and JavaScript.",
    category: "speech-to-text",
    tags: ["beginner", "rest-api", "python", "javascript"],
    difficulty: "beginner",
    status: "code-only",
    cookbookPath: "speech-to-text/getting-started",
    githubUrl: `${GITHUB_BASE}/speech-to-text/getting-started`,
    techStack: ["Python", "JavaScript"],
    apiProducts: ["pulse-stt"],
    features: [
      "Basic audio file transcription",
      "Python and JavaScript implementations",
      "Simple REST API usage",
    ],
  },
  {
    slug: "file-transcription",
    title: "Advanced File Transcription",
    description:
      "Transcribe files with all advanced features — timestamps, diarization, language detection.",
    category: "speech-to-text",
    tags: ["files", "timestamps", "diarization", "languages"],
    difficulty: "beginner",
    status: "code-only",
    cookbookPath: "speech-to-text/file-transcription",
    githubUrl: `${GITHUB_BASE}/speech-to-text/file-transcription`,
    techStack: ["Python"],
    apiProducts: ["pulse-stt"],
    features: [
      "Word-level timestamps",
      "Speaker diarization",
      "Language detection",
      "Multiple output formats",
    ],
  },
  {
    slug: "word-level-outputs",
    title: "Word-Level Outputs",
    description:
      "Get precise word timestamps and speaker diarization for detailed audio analysis.",
    category: "speech-to-text",
    tags: ["timestamps", "diarization", "precision"],
    difficulty: "beginner",
    status: "code-only",
    cookbookPath: "speech-to-text/word-level-outputs",
    githubUrl: `${GITHUB_BASE}/speech-to-text/word-level-outputs`,
    techStack: ["Python"],
    apiProducts: ["pulse-stt"],
    features: [
      "Word-level timestamps",
      "Speaker identification",
      "Precise timing data",
    ],
  },
  {
    slug: "subtitle-generation",
    title: "Subtitle Generation",
    description:
      "Generate SRT and VTT subtitle files from audio or video content automatically.",
    category: "speech-to-text",
    tags: ["subtitles", "srt", "vtt", "video"],
    difficulty: "beginner",
    status: "code-only",
    cookbookPath: "speech-to-text/subtitle-generation",
    githubUrl: `${GITHUB_BASE}/speech-to-text/subtitle-generation`,
    techStack: ["Python"],
    apiProducts: ["pulse-stt"],
    features: [
      "SRT subtitle generation",
      "VTT subtitle generation",
      "Configurable segment duration",
    ],
  },
  {
    slug: "podcast-summarizer",
    title: "Podcast Summarizer",
    description:
      "Transcribe and summarize podcasts with key takeaways using GPT-4o.",
    category: "speech-to-text",
    tags: ["podcast", "summarization", "gpt-4o", "ai"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "speech-to-text/podcast-summarizer",
    githubUrl: `${GITHUB_BASE}/speech-to-text/podcast-summarizer`,
    techStack: ["Python", "OpenAI GPT-4o"],
    apiProducts: ["pulse-stt"],
    features: [
      "Podcast audio transcription",
      "AI-powered summarization",
      "Key takeaways extraction",
      "Speaker-aware summaries",
    ],
  },
  {
    slug: "youtube-summarizer",
    title: "YouTube Summarizer",
    description:
      "Transcribe and summarize any YouTube video with AI — paste a link, get a summary.",
    category: "speech-to-text",
    tags: ["youtube", "summarization", "groq", "video"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "speech-to-text/youtube-summarizer",
    githubUrl: `${GITHUB_BASE}/speech-to-text/youtube-summarizer`,
    techStack: ["Python", "Groq", "yt-dlp"],
    apiProducts: ["pulse-stt"],
    features: [
      "YouTube audio extraction",
      "Full video transcription",
      "AI summarization with Groq",
      "Key points extraction",
    ],
  },
  {
    slug: "meeting-notetaker",
    title: "Online Meeting Notetaker",
    description:
      "Join Google Meet, Zoom, or Teams meetings via Recall.ai and auto-generate speaker-identified notes.",
    category: "speech-to-text",
    tags: ["meetings", "recall.ai", "zoom", "google-meet", "notes"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "speech-to-text/online-meeting-notetaking-bot",
    githubUrl: `${GITHUB_BASE}/speech-to-text/online-meeting-notetaking-bot`,
    techStack: ["Python", "Recall.ai", "OpenAI"],
    apiProducts: ["pulse-stt"],
    features: [
      "Join meetings via bot (Zoom, Meet, Teams)",
      "Auto speaker identification",
      "Structured note generation",
      "Real-time transcription",
    ],
  },
  {
    slug: "streaming-transcription",
    title: "Streaming Transcription",
    description:
      "Stream audio files via WebSocket for real-time transcription results.",
    category: "speech-to-text",
    tags: ["websocket", "streaming", "real-time"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "speech-to-text/websocket/streaming-text-output-transcription",
    githubUrl: `${GITHUB_BASE}/speech-to-text/websocket/streaming-text-output-transcription`,
    techStack: ["Python", "JavaScript", "WebSocket"],
    apiProducts: ["pulse-stt"],
    features: [
      "WebSocket-based streaming",
      "Partial and final transcripts",
      "Python and JavaScript implementations",
    ],
  },
  {
    slug: "realtime-microphone",
    title: "Realtime Microphone Transcription",
    description:
      "Gradio web UI with live microphone input — see your speech transcribed in real-time.",
    category: "speech-to-text",
    tags: ["microphone", "gradio", "real-time", "web-ui"],
    difficulty: "intermediate",
    status: "demo",
    cookbookPath: "speech-to-text/websocket/realtime-microphone-transcription",
    githubUrl: `${GITHUB_BASE}/speech-to-text/websocket/realtime-microphone-transcription`,
    techStack: ["Python", "Gradio", "WebSocket"],
    apiProducts: ["pulse-stt"],
    features: [
      "Live microphone capture",
      "Real-time transcription display",
      "Gradio web interface",
      "WebSocket streaming",
    ],
  },

  // ─── VOICE AGENTS ─────────────────────────────────────
  {
    slug: "getting-started-agents",
    title: "Getting Started with Voice Agents",
    description:
      "Create your first voice agent with OutputAgentNode, generate_response(), and AtomsApp.",
    category: "voice-agents",
    tags: ["beginner", "atoms-sdk", "basics"],
    difficulty: "beginner",
    status: "code-only",
    cookbookPath: "voice-agents/getting_started",
    githubUrl: `${GITHUB_BASE}/voice-agents/getting_started`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "OutputAgentNode setup",
      "generate_response() implementation",
      "AtomsApp configuration",
    ],
  },
  {
    slug: "agent-with-tools",
    title: "Voice Agent with Tools",
    description:
      "Build agents that call functions, query APIs, and take actions using @function_tool.",
    category: "voice-agents",
    tags: ["tools", "function-calling", "api"],
    difficulty: "beginner",
    status: "code-only",
    featured: true,
    cookbookPath: "voice-agents/agent_with_tools",
    githubUrl: `${GITHUB_BASE}/voice-agents/agent_with_tools`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "@function_tool decorator",
      "ToolRegistry management",
      "Dynamic tool execution",
      "API integration patterns",
    ],
  },
  {
    slug: "call-control",
    title: "Call Control",
    description:
      "Cold and warm call transfers, ending calls programmatically with SDKAgentEndCallEvent.",
    category: "voice-agents",
    tags: ["transfers", "call-control", "events"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/call_control",
    githubUrl: `${GITHUB_BASE}/voice-agents/call_control`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "Cold call transfers",
      "Warm call transfers",
      "Programmatic call ending",
      "SDKAgentEndCallEvent usage",
    ],
  },
  {
    slug: "background-agent",
    title: "Background Agent",
    description:
      "BackgroundAgentNode for parallel processing and cross-node state sharing.",
    category: "voice-agents",
    tags: ["background", "parallel", "state-management"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/background_agent",
    githubUrl: `${GITHUB_BASE}/voice-agents/background_agent`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "BackgroundAgentNode setup",
      "Parallel node execution",
      "Cross-node state sharing",
    ],
  },
  {
    slug: "observability",
    title: "Observability with Langfuse",
    description:
      "Langfuse integration for live traces, tool spans, and transcript events on voice agents.",
    category: "voice-agents",
    tags: ["observability", "langfuse", "tracing", "monitoring"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/observability",
    githubUrl: `${GITHUB_BASE}/voice-agents/observability`,
    techStack: ["Python", "Atoms SDK", "Langfuse"],
    apiProducts: ["atoms"],
    features: [
      "Langfuse trace integration",
      "Tool call span tracking",
      "Transcript event logging",
      "BackgroundAgentNode for async logging",
    ],
  },
  {
    slug: "language-switching",
    title: "Language Switching",
    description:
      "Multi-node agents with dynamic language detection and seamless switching.",
    category: "voice-agents",
    tags: ["multilingual", "language-detection", "multi-node"],
    difficulty: "advanced",
    status: "code-only",
    cookbookPath: "voice-agents/language_switching",
    githubUrl: `${GITHUB_BASE}/voice-agents/language_switching`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "Dynamic language detection",
      "Multi-node graph with add_edge()",
      "Seamless language switching",
      "Custom node implementations",
    ],
  },
  {
    slug: "inbound-ivr",
    title: "Inbound IVR",
    description:
      "Intent routing, department transfers, and mute/unmute control for inbound call handling.",
    category: "voice-agents",
    tags: ["ivr", "routing", "inbound", "departments"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/inbound_ivr",
    githubUrl: `${GITHUB_BASE}/voice-agents/inbound_ivr`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "Intent classification",
      "Department routing",
      "Call transfers",
      "Mute/unmute control",
    ],
  },
  {
    slug: "interrupt-control",
    title: "Interrupt Control",
    description:
      "Handle mute/unmute events and block user interruptions during critical speech segments.",
    category: "voice-agents",
    tags: ["interruptions", "mute", "control"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/interrupt_control",
    githubUrl: `${GITHUB_BASE}/voice-agents/interrupt_control`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "Mute/unmute event handling",
      "Block interruptions during critical speech",
      "Configurable interrupt behavior",
    ],
  },
  {
    slug: "knowledge-base-rag",
    title: "Knowledge Base RAG",
    description:
      "Attach knowledge bases with PDF upload and URL scraping for grounded voice agent responses.",
    category: "voice-agents",
    tags: ["rag", "knowledge-base", "pdf", "scraping"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/knowledge_base_rag",
    githubUrl: `${GITHUB_BASE}/voice-agents/knowledge_base_rag`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "Knowledge base creation",
      "PDF document upload",
      "URL scraping for context",
      "Grounded response generation",
    ],
  },
  {
    slug: "campaigns",
    title: "Outbound Campaigns",
    description:
      "Provision bulk outbound calling with audiences, contacts, and campaign management.",
    category: "voice-agents",
    tags: ["campaigns", "outbound", "bulk", "audiences"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/campaigns",
    githubUrl: `${GITHUB_BASE}/voice-agents/campaigns`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "Audience management",
      "Contact list handling",
      "Campaign creation and monitoring",
      "Bulk outbound calls",
    ],
  },
  {
    slug: "analytics-voice-agents",
    title: "Voice Agent Analytics",
    description:
      "Call logs, transcript exports, and post-call metrics for voice agent monitoring.",
    category: "voice-agents",
    tags: ["analytics", "logs", "transcripts", "metrics"],
    difficulty: "beginner",
    status: "code-only",
    cookbookPath: "voice-agents/analytics",
    githubUrl: `${GITHUB_BASE}/voice-agents/analytics`,
    techStack: ["Python", "Atoms SDK"],
    apiProducts: ["atoms"],
    features: [
      "Call log retrieval",
      "Transcript exports",
      "Post-call metrics",
      "Usage analytics",
    ],
  },
  {
    slug: "appointment-scheduler",
    title: "Appointment Scheduler",
    description:
      "Voice agent that schedules appointments via Cal.com integration with natural conversation.",
    category: "voice-agents",
    tags: ["scheduling", "cal.com", "booking", "integration"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/appointment_scheduler",
    githubUrl: `${GITHUB_BASE}/voice-agents/appointment_scheduler`,
    techStack: ["Python", "Atoms SDK", "Cal.com API"],
    apiProducts: ["atoms"],
    features: [
      "Cal.com API integration",
      "Natural language scheduling",
      "Availability checking",
      "Appointment confirmation",
    ],
  },
  {
    slug: "form-filler",
    title: "Voice Form Filler",
    description:
      "Fill out JotForm forms entirely via voice conversation — the agent asks questions and submits.",
    category: "voice-agents",
    tags: ["forms", "jotform", "data-collection", "automation"],
    difficulty: "intermediate",
    status: "code-only",
    cookbookPath: "voice-agents/form_filler",
    githubUrl: `${GITHUB_BASE}/voice-agents/form_filler`,
    techStack: ["Python", "Atoms SDK", "JotForm API"],
    apiProducts: ["atoms"],
    features: [
      "JotForm integration",
      "Voice-driven form filling",
      "Dynamic question flow",
      "Automatic form submission",
    ],
  },
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getProjectsByCategory(category: string): Project[] {
  if (category === "all" || !category) return projects;
  return projects.filter((p) => p.category === category);
}

export function getFeaturedProjects(): Project[] {
  return projects.filter((p) => p.featured);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(projects.map((p) => p.category)));
}

export function getAllTags(): string[] {
  return Array.from(new Set(projects.flatMap((p) => p.tags)));
}
