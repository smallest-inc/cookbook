"use client";

import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Check } from "lucide-react";
import { trackApiKeyEntered } from "@/lib/analytics";

interface ApiKeyInputProps {
  projectSlug: string;
  onKeyChange?: (key: string) => void;
}

export function ApiKeyInput({ projectSlug, onKeyChange }: ApiKeyInputProps) {
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("smallest-api-key");
    if (stored) {
      setKey(stored);
      onKeyChange?.(stored);
    }
  }, [onKeyChange]);

  const handleSave = () => {
    if (!key.trim()) return;
    localStorage.setItem("smallest-api-key", key);
    onKeyChange?.(key);
    setSaved(true);
    trackApiKeyEntered(projectSlug);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Key className="h-4 w-4 text-teal" />
        <h4 className="text-sm font-semibold">Try with your API key</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Your key is stored locally in your browser and never sent to our
        servers.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-10 text-sm placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
          <button
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!key.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Get your API key at{" "}
        <a
          href="https://smallest.ai/console"
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal hover:underline"
        >
          smallest.ai/console
        </a>
      </p>
    </div>
  );
}
