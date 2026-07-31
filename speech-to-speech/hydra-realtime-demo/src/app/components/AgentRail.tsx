"use client";

import clsx from "clsx";
import { AGENT_PRESETS, type AgentPreset } from "@/app/agents/presets";

export interface AgentRailProps {
  active: string;
  onPick: (id: string) => void;
}

export default function AgentRail({ active, onPick }: AgentRailProps) {
  const grouped = new Map<string, AgentPreset[]>();
  for (const a of AGENT_PRESETS) {
    if (!grouped.has(a.category)) grouped.set(a.category, []);
    grouped.get(a.category)!.push(a);
  }
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-ink-700 flex items-center gap-2">
        <div className="h-2 w-2 bg-ink-300" />
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-300">
          Agents
        </span>
        <span className="ml-auto text-[10px] font-mono text-ink-400">
          {AGENT_PRESETS.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scroll p-2">
        {[...grouped.entries()].map(([cat, agents]) => (
          <div key={cat} className="mb-3">
            <div className="px-2 py-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-ink-400/80">
              {cat}
            </div>
            <div className="space-y-1">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a.id)}
                  className={clsx(
                    "w-full text-left flex gap-3 items-start px-2.5 py-2 border transition",
                    active === a.id
                      ? "bg-ink-800 border-ink-600"
                      : "border-transparent hover:bg-ink-900",
                  )}
                >
                  <div className="h-9 w-9 flex-shrink-0 bg-ink-900 border border-ink-700 flex items-center justify-center text-lg">
                    {a.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-ink-100 truncate">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-ink-400 leading-snug line-clamp-2">
                      {a.tagline}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
