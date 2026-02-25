import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl font-bold text-foreground/10 mb-4">404</div>
      <h1 className="text-2xl font-bold">Project not found</h1>
      <p className="mt-2 text-muted-foreground max-w-sm">
        The project you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Showcase
      </Link>
    </div>
  );
}
