"use client";

import Link from "next/link";
import { ExternalLink, Play, Code2, ArrowUpRight, Mic, Volume2, Bot, Users } from "lucide-react";
import { Project, Category } from "@/lib/types";
import { trackProjectCardClick } from "@/lib/analytics";
import { getProjectGradient } from "@/lib/gradients";
import { DifficultyBadge } from "./DifficultyBadge";

const categoryIcon: Record<Category, typeof Mic> = {
  "speech-to-text": Mic,
  "text-to-speech": Volume2,
  "voice-agents": Bot,
  community: Users,
};

const categoryLabel: Record<Category, string> = {
  "speech-to-text": "Speech to Text",
  "text-to-speech": "Text to Speech",
  "voice-agents": "Voice Agents",
  community: "Community",
};

interface ProjectCardProps {
  project: Project;
  index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const handleClick = () => {
    trackProjectCardClick(project.slug, project.category, index);
  };

  const gradient = getProjectGradient(project.slug, project.category);
  const Icon = categoryIcon[project.category];

  return (
    <Link
      href={`/projects/${project.slug}`}
      onClick={handleClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:border-border hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-1"
    >
      {/* Gradient Thumbnail */}
      <div className={`relative aspect-[16/10] overflow-hidden ${gradient}`}>
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        {/* Floating icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 dark:bg-white/10 backdrop-blur-md shadow-lg transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-6 w-6 text-foreground/60" />
          </div>
        </div>

        {/* Badges */}
        {project.featured && (
          <div className="absolute left-3 top-3 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold text-foreground/80">
            Featured
          </div>
        )}
        {(project.status === "demo" || project.status === "live") && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {project.status === "live" ? "Interactive" : "Live Demo"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold leading-snug text-card-foreground group-hover:text-foreground transition-colors line-clamp-1">
            {project.title}
          </h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground line-clamp-2 flex-1">
          {project.description}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            <span>{categoryLabel[project.category]}</span>
          </div>
          <DifficultyBadge level={project.difficulty} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center border-t border-border/60">
        {project.demoUrl || project.status === "demo" || project.status === "live" ? (
          <span className="flex flex-1 items-center justify-center gap-1.5 border-r border-border/60 py-2.5 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
            <ExternalLink className="h-3 w-3" />
            Demo
          </span>
        ) : null}
        <span className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
          <Code2 className="h-3 w-3" />
          Code
        </span>
        {project.videoUrl && (
          <span className="flex flex-1 items-center justify-center gap-1.5 border-l border-border/60 py-2.5 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
            <Play className="h-3 w-3" />
            Video
          </span>
        )}
      </div>
    </Link>
  );
}
