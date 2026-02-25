"use client";

import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import { getProjectsByCategory } from "@/lib/projects";
import { ProjectCard } from "@/components/ProjectCard";
import { SearchBar } from "@/components/SearchBar";

interface CategoryGalleryProps {
  slug: string;
  title: string;
  description: string;
}

export function CategoryGallery({ slug, title, description }: CategoryGalleryProps) {
  const allProjects = useMemo(() => getProjectsByCategory(slug), [slug]);
  const [search, setSearch] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(allProjects, {
        keys: ["title", "description", "tags", "techStack"],
        threshold: 0.3,
      }),
    [allProjects]
  );

  const filtered = useMemo(() => {
    if (search.length < 2) return allProjects;
    return fuse.search(search).map((r) => r.item);
  }, [search, allProjects, fuse]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{description}</p>
      </div>

      <div className="mb-8 max-w-sm">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={`Search ${title.toLowerCase()}...`}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold">No projects found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, i) => (
            <div
              key={project.slug}
              className="animate-slide-up opacity-0"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
            >
              <ProjectCard project={project} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
