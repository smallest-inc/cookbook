"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Fuse from "fuse.js";
import Link from "next/link";
import { ArrowRight, Plus, ArrowUpRight } from "lucide-react";
import { projects, getFeaturedProjects } from "@/lib/projects";
import { trackSearch, trackSubmitProjectClick, trackGetApiKeyClick } from "@/lib/analytics";
import { ProjectCard } from "@/components/ProjectCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { SearchBar } from "@/components/SearchBar";

const fuse = new Fuse(projects, {
  keys: ["title", "description", "tags", "techStack", "category"],
  threshold: 0.3,
});

export default function HomePage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (value.length > 2) {
      const results = fuse.search(value);
      trackSearch(value, results.length);
    }
  }, []);

  const filteredProjects = useMemo(() => {
    let results = projects;

    if (category === "all") {
      results = getFeaturedProjects();
    } else {
      results = projects.filter((p) => p.category === category);
    }

    if (search.length > 1) {
      const searchResults = fuse.search(search).map((r) => r.item);
      if (category !== "all") {
        results = searchResults.filter((p) => p.category === category);
      } else {
        results = searchResults;
      }
    }

    return results;
  }, [category, search]);

  const totalCount = useMemo(() => {
    if (category === "all") return projects.length;
    return projects.filter((p) => p.category === category).length;
  }, [category]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <Image
              src="/smallest-icon.png"
              alt="Smallest AI"
              width={48}
              height={48}
              className="mx-auto mb-8 rounded-xl"
            />
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-tight leading-[1.1]">
              Explore what developers are
              <br />
              building with Smallest AI
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              A curated gallery of voice and audio experiences powered by
              Smallest AI. Try live demos, fork the code, build your own.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://app.smallest.ai/dashboard/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackGetApiKeyClick("hero")}
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90"
              >
                Get API Key
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/community"
                onClick={() => trackSubmitProjectClick("hero")}
                className="group inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
              >
                Submit Project
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground/70 tracking-wide uppercase">
              {projects.length} projects &middot; STT &middot; TTS &middot; Voice Agents
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <CategoryFilter active={category} onChange={setCategory} />
          <div className="sm:w-72">
            <SearchBar value={search} onChange={handleSearch} />
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground mb-8">
          {search
            ? `${filteredProjects.length} results for "${search}"`
            : category === "all"
            ? `Showing ${filteredProjects.length} featured projects`
            : `${filteredProjects.length} of ${totalCount} projects`}
        </p>

        {/* Grid */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-5xl mb-4 opacity-30">🔍</p>
            <h3 className="text-base font-semibold">No projects found</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              {search
                ? `No matches for "${search}". Try a different term.`
                : "No projects in this category yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project, i) => (
              <div
                key={project.slug}
                className="animate-slide-up opacity-0"
                style={{ animationDelay: `${i * 0.04}s`, animationFillMode: "forwards" }}
              >
                <ProjectCard project={project} index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
