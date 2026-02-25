import { Mic, Volume2, Bot, Users } from "lucide-react";
import type { Category } from "@/lib/types";

const config: Record<
  Category,
  { label: string; icon: typeof Mic; className: string }
> = {
  "speech-to-text": {
    label: "Speech to Text",
    icon: Mic,
    className: "bg-foreground/5 text-foreground/70 border-foreground/10",
  },
  "text-to-speech": {
    label: "Text to Speech",
    icon: Volume2,
    className: "bg-foreground/5 text-foreground/70 border-foreground/10",
  },
  "voice-agents": {
    label: "Voice Agents",
    icon: Bot,
    className: "bg-foreground/5 text-foreground/70 border-foreground/10",
  },
  community: {
    label: "Community",
    icon: Users,
    className: "bg-foreground/5 text-foreground/70 border-foreground/10",
  },
};

interface CategoryBadgeProps {
  category: Category;
  size?: "sm" | "md";
}

export function CategoryBadge({ category, size = "sm" }: CategoryBadgeProps) {
  const { label, icon: Icon, className } = config[category];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${className} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label}
    </span>
  );
}
