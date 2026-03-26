"use client";

import Image from "next/image";
import { trackGetApiKeyClick, trackExternalLinkClick } from "@/lib/analytics";

const EXTERNAL_UTM = "utm_source=showcase&utm_medium=footer&utm_campaign=showcase";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/smallest-icon.png"
              alt="Smallest AI"
              width={24}
              height={24}
              className="rounded-md"
            />
            <span className="text-sm font-medium text-muted-foreground">
              Smallest AI Showcase
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a
              href="https://smallest.ai"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackExternalLinkClick("smallest_ai", "https://smallest.ai", "footer")}
              className="hover:text-foreground transition-colors"
            >
              smallest.ai
            </a>
            <a
              href="https://app.smallest.ai"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackExternalLinkClick("atoms_platform", "https://app.smallest.ai", "footer")}
              className="hover:text-foreground transition-colors"
            >
              Atoms Platform
            </a>
            <a
              href="https://waves-docs.smallest.ai"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackExternalLinkClick("waves_docs", "https://waves-docs.smallest.ai", "footer")}
              className="hover:text-foreground transition-colors"
            >
              Waves Docs
            </a>
            <a
              href="https://atoms-docs.smallest.ai"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackExternalLinkClick("atoms_docs", "https://atoms-docs.smallest.ai", "footer")}
              className="hover:text-foreground transition-colors"
            >
              Atoms Docs
            </a>
            <a
              href={`https://github.com/smallest-inc/cookbook?${EXTERNAL_UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackExternalLinkClick("github", "https://github.com/smallest-inc/cookbook", "footer")}
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href={`https://discord.gg/5evETqguJs?${EXTERNAL_UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackExternalLinkClick("discord", "https://discord.gg/5evETqguJs", "footer")}
              className="hover:text-foreground transition-colors font-medium text-teal"
            >
              Join Discord
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="https://app.smallest.ai/dashboard/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackGetApiKeyClick("footer")}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-xs font-medium text-background transition-all hover:opacity-90"
          >
            Get API Key
          </a>
          <a
            href={`https://github.com/smallest-inc/cookbook?${EXTERNAL_UTM}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackExternalLinkClick("github", "https://github.com/smallest-inc/cookbook", "footer")}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted"
          >
            Contribute on GitHub
          </a>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/60">
          Built with Smallest AI APIs
        </p>
      </div>
    </footer>
  );
}
