"use client";

import { useMemo, useState } from "react";
import { GitPullRequest, Plus, ArrowRight, Users } from "lucide-react";
import { projects } from "@/lib/projects";
import { ProjectCard } from "@/components/ProjectCard";
import { SearchBar } from "@/components/SearchBar";
import { trackSubmitProjectClick } from "@/lib/analytics";

export function CommunityPage() {
  const communityProjects = useMemo(
    () => projects.filter((p) => p.category === "community"),
    []
  );
  const [search, setSearch] = useState("");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="mb-12 max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1 text-sm text-foreground">
          <Users className="h-4 w-4" />
          Community
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Community Projects
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Explore projects built by the Smallest AI community. Have something
          cool? Submit yours via a pull request.
        </p>
      </div>

      {/* How to Submit */}
      <div className="mb-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <GitPullRequest className="h-5 w-5 text-teal" />
          Submit Your Project
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
              1
            </div>
            <h3 className="font-medium">Fork & Add</h3>
            <p className="text-sm text-muted-foreground">
              Fork the{" "}
              <a
                href="https://github.com/smallest-inc/cookbook?utm_source=showcase&utm_medium=community&utm_campaign=fork-repo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal hover:underline"
              >
                cookbook repo
              </a>{" "}
              and add your project to the <code className="text-xs bg-muted px-1 py-0.5 rounded">community/</code>{" "}
              folder with a README and project.json.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
              2
            </div>
            <h3 className="font-medium">Open a PR</h3>
            <p className="text-sm text-muted-foreground">
              Submit a pull request. Include a description, screenshots or GIF,
              and which Smallest AI APIs you used.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
              3
            </div>
            <h3 className="font-medium">Get Featured</h3>
            <p className="text-sm text-muted-foreground">
              Once merged, your project appears here automatically. Outstanding
              projects get featured on the homepage.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <a
            href="https://github.com/smallest-inc/cookbook/fork?utm_source=showcase&utm_medium=community&utm_campaign=submit-project"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackSubmitProjectClick("community_page")}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Submit a Project
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Gallery */}
      {communityProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No community projects yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Be the first to submit a community project! Fork the cookbook repo,
            add your project, and open a pull request.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 max-w-sm">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {communityProjects.map((project, i) => (
              <ProjectCard key={project.slug} project={project} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
