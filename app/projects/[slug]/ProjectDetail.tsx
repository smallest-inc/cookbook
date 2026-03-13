"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Github,
  Play,
  Copy,
  Check,
  Share2,
  Terminal,
  Layers,
  Zap,
  Mic,
  Volume2,
  Bot,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Project, Category } from "@/lib/types";
import { getProjectGradient } from "@/lib/gradients";
import { CategoryBadge } from "@/components/CategoryBadge";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { TryTTS } from "@/components/TryTTS";
import {
  trackProjectView,
  trackDemoLaunch,
  trackCodeView,
  trackVideoPlay,
  trackShareClick,
} from "@/lib/analytics";

export function ProjectDetail({ project }: { project: Project }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    trackProjectView(project.slug, project.category);
  }, [project.slug, project.category]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    trackShareClick(project.slug, "copy_link");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    trackShareClick(project.slug, "twitter");
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      `Check out "${project.title}" built with @smallest_AI`
    );
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`);
  };

  const cloneCommand = `git clone https://github.com/smallest-inc/cookbook.git && cd cookbook/${project.cookbookPath}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back + Share */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Showcase
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy Link"}
          </button>
          <button
            onClick={handleShareTwitter}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <CategoryBadge category={project.category} size="md" />
          <DifficultyBadge level={project.difficulty} />
          {project.apiProducts.map((product) => (
            <span
              key={product}
              className="inline-flex items-center rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-medium text-teal"
            >
              {product === "pulse-stt"
                ? "Pulse STT"
                : product === "lightning-tts"
                ? "Lightning TTS"
                : product === "atoms"
                ? "Atoms SDK"
                : "Voice Cloning"}
            </span>
          ))}
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {project.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {project.longDescription || project.description}
        </p>

        {project.author && (
          <div className="mt-4 flex items-center gap-3">
            {project.author.avatar && (
              <img
                src={project.author.avatar}
                alt={project.author.name}
                className="h-8 w-8 rounded-full"
              />
            )}
            <div>
              <span className="text-sm font-medium">{project.author.name}</span>
              {project.author.github && (
                <a
                  href={`https://github.com/${project.author.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-muted-foreground hover:text-primary"
                >
                  @{project.author.github}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap gap-3 animate-fade-in stagger-1">
        {project.demoUrl && (
          <a
            href={project.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackDemoLaunch(project.slug, "external")}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            Live Demo
          </a>
        )}
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackCodeView(project.slug)}
          className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
        >
          <Github className="h-4 w-4" />
          View Code
        </a>
        {project.videoUrl && (
          <a
            href={project.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackVideoPlay(project.slug)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
          >
            <Play className="h-4 w-4" />
            Watch Video
          </a>
        )}
      </div>

      {/* Project Visual */}
      <div className="mt-8 animate-fade-in stagger-2">
        {project.thumbnailUrl ? (
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={project.thumbnailUrl}
              alt={project.title}
              className="w-full"
            />
          </div>
        ) : project.gifUrl ? (
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={project.gifUrl}
              alt={`${project.title} demo`}
              className="w-full"
            />
          </div>
        ) : (
          <ProjectCover project={project} />
        )}
      </div>

      {/* Main Content Grid */}
      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {/* Left: Features + Description */}
        <div className="lg:col-span-2 space-y-8">
          {/* Features */}
          {project.features && project.features.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
                <Zap className="h-5 w-5 text-teal" />
                Features
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {project.features.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Audio Samples */}
          {project.audioSamples && project.audioSamples.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
                <Play className="h-5 w-5 text-teal" />
                Audio Samples
              </h2>
              <div className="space-y-3">
                {project.audioSamples.map((sample) => (
                  <AudioPlayer
                    key={sample.label}
                    src={sample.src}
                    label={sample.label}
                    projectSlug={project.slug}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Interactive TTS Playground */}
          {project.tryItConfig?.type === "tts" && project.slug === "tts-playground" && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
                <Zap className="h-5 w-5 text-teal" />
                Try It Live
              </h2>
              <TryTTS projectSlug={project.slug} />
            </section>
          )}

          {/* Quick Start */}
          <section>
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
                <Terminal className="h-5 w-5 text-teal" />
              Quick Start
            </h2>
            <div className="rounded-xl border border-border bg-secondary/50 p-4 font-mono text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">terminal</span>
                <CopyButton text={cloneCommand} />
              </div>
              <code className="text-secondary-foreground whitespace-pre-wrap break-all">
                {cloneCommand}
              </code>
            </div>
            {project.setupSteps && (
              <ol className="mt-4 space-y-2">
                {project.setupSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Try It */}
          {project.tryItConfig && (
            <ApiKeyInput projectSlug={project.slug} />
          )}

          {/* Tech Stack */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                <Layers className="h-4 w-4 text-teal" />
              Tech Stack
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {project.techStack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Resources</h3>
            <div className="space-y-2">
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
                Source Code
              </a>
              <a
                href="https://docs.smallest.ai?utm_source=showcase&utm_medium=project_sidebar&utm_campaign=docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                API Documentation
              </a>
              <a
                href="https://app.smallest.ai/dashboard/settings/apikeys?utm_source=showcase&utm_medium=project_sidebar&utm_campaign=get-api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Get API Key
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const categoryIconMap: Record<Category, typeof Mic> = {
  "speech-to-text": Mic,
  "text-to-speech": Volume2,
  "voice-agents": Bot,
  community: Users,
};

const categoryLabel: Record<Category, string> = {
  "speech-to-text": "Speech to Text",
  "text-to-speech": "Text to Speech",
  "voice-agents": "Voice Agent",
  community: "Community",
};

function ProjectCover({ project }: { project: Project }) {
  const Icon = categoryIconMap[project.category];
  const gradient = getProjectGradient(project.slug, project.category);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${gradient} border border-border`}
    >
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]">
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Decorative circles */}
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-foreground/[0.03]" />
      <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-foreground/[0.03]" />

      <div className="relative flex flex-col items-center justify-center px-8 py-14 sm:py-16 text-center">
        {/* Category icon */}
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 dark:bg-white/10 backdrop-blur-sm shadow-sm border border-white/40 dark:border-white/10">
          <Icon className="h-6 w-6 text-foreground/60" />
        </div>

        {/* Project title — typographic hero */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground/80 max-w-xl leading-tight">
          {project.title}
        </h2>

        {/* Category label */}
        <span className="mt-3 text-xs font-medium uppercase tracking-widest text-foreground/40">
          {categoryLabel[project.category]}
        </span>

        {/* Tech stack pills */}
        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {project.techStack.slice(0, 5).map((tech) => (
            <span
              key={tech}
              className="rounded-full bg-foreground/[0.06] dark:bg-white/[0.08] px-3 py-1 text-[11px] font-medium text-foreground/50"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
