"use client";

import { Mic, Volume2, Bot, Users, Sparkles } from "lucide-react";
import { trackCategoryFilter } from "@/lib/analytics";

const categories = [
  { id: "all", label: "Featured", icon: Sparkles },
  { id: "speech-to-text", label: "Speech to Text", icon: Mic },
  { id: "text-to-speech", label: "Text to Speech", icon: Volume2 },
  { id: "voice-agents", label: "Voice Agents", icon: Bot },
  { id: "community", label: "Community", icon: Users },
];

interface CategoryFilterProps {
  active: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  const handleChange = (id: string) => {
    trackCategoryFilter(id, active);
    onChange(id);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => handleChange(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
