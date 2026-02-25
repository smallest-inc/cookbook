import type { Category } from "./types";

export const categoryGradients: Record<Category, string> = {
  "speech-to-text":
    "bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/40",
  "text-to-speech":
    "bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/40",
  "voice-agents":
    "bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40",
  community:
    "bg-gradient-to-br from-rose-100 via-pink-50 to-fuchsia-100 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-fuchsia-950/40",
};

export const categoryIcons: Record<Category, string> = {
  "speech-to-text": "🎙",
  "text-to-speech": "🔊",
  "voice-agents": "🤖",
  community: "👥",
};

const projectGradients: Record<string, string> = {
  "jarvis-voice-assistant":
    "bg-gradient-to-br from-slate-200 via-zinc-100 to-stone-200 dark:from-slate-800/60 dark:via-zinc-800/40 dark:to-stone-800/60",
  "emotion-analyzer":
    "bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-fuchsia-950/40",
  "atoms-sdk-web-agent":
    "bg-gradient-to-br from-amber-100 via-orange-50 to-red-100 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-red-950/40",
  "bank-csr":
    "bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-teal-950/40",
  "agent-with-tools":
    "bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100 dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-blue-950/40",
};

export function getProjectGradient(slug: string, category: Category): string {
  return projectGradients[slug] || categoryGradients[category];
}
