export type Category =
  | "speech-to-text"
  | "text-to-speech"
  | "voice-agents"
  | "community";

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export type ProjectStatus = "live" | "demo" | "code-only";

export interface AudioSample {
  label: string;
  src: string;
  duration?: string;
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  longDescription?: string;
  category: Category;
  tags: string[];
  difficulty: DifficultyLevel;
  status: ProjectStatus;
  featured?: boolean;

  cookbookPath: string;
  githubUrl: string;

  demoUrl?: string;
  videoUrl?: string;
  gifUrl?: string;
  thumbnailUrl?: string;

  audioSamples?: AudioSample[];

  author?: {
    name: string;
    github?: string;
    avatar?: string;
  };

  techStack: string[];
  apiProducts: ("pulse-stt" | "lightning-tts" | "atoms" | "voice-cloning")[];

  tryItConfig?: {
    type: "tts" | "stt" | "agent";
    placeholder?: string;
    sampleInput?: string;
  };

  features?: string[];
  setupSteps?: string[];
}

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, string | number | boolean>;
}
