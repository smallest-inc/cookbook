import type { DifficultyLevel } from "@/lib/types";

const config: Record<DifficultyLevel, { label: string; className: string }> = {
  beginner: {
    label: "Beginner",
    className: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  intermediate: {
    label: "Intermediate",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  advanced: {
    label: "Advanced",
    className: "bg-red-500/10 text-red-500 dark:text-red-400",
  },
};

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  const { label, className } = config[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}
