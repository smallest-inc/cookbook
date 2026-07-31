"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { TranscriptBubble } from "@/app/types";

export interface TranscriptProps {
  bubbles: TranscriptBubble[];
}

export default function Transcript({ bubbles }: TranscriptProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const near =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (near) el.scrollTop = el.scrollHeight;
  }, [bubbles]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-300">
          Conversation
        </span>
        <span className="ml-auto text-[10px] font-mono text-ink-400">
          {bubbles.length} turn{bubbles.length === 1 ? "" : "s"}
        </span>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto scroll p-4 space-y-3">
        {bubbles.length === 0 && (
          <div className="text-center text-xs text-ink-400/70 italic mt-12">
            Your conversation will appear here. Start by saying hello.
          </div>
        )}
        {bubbles.map((b) => (
          <BubbleView key={b.id} b={b} />
        ))}
      </div>
    </div>
  );
}

function BubbleView({ b }: { b: TranscriptBubble }) {
  const isUser = b.role === "user";
  return (
    <div className={clsx("animate-fade-in", isUser && "ml-auto")}>
      <div className="flex flex-col gap-2 max-w-[90%]">
        <div
          className={clsx(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "ml-auto bg-brand-500/90 text-white border border-brand-300/30"
              : "bg-white/[0.06] text-ink-100 border border-white/[0.07]",
            b.status === "incomplete" && "opacity-60 border-dashed",
          )}
        >
          <div
            className={clsx(
              "text-[10px] font-mono uppercase tracking-widest mb-1",
              isUser ? "text-white/70" : "text-ink-400",
            )}
          >
            {isUser ? "you" : "hydra"}
            {b.status === "incomplete" && " · cancelled"}
            {b.status === "in_progress" && (
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
          </div>
          <div className={clsx(!b.text && "text-ink-300/60 italic text-xs")}>
            {b.text ||
              (b.status === "in_progress"
                ? isUser
                  ? "spoke an audio turn…"
                  : "responding with audio…"
                : isUser
                  ? "audio turn"
                  : "audio response")}
          </div>
        </div>
        {b.toolCalls && b.toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {b.toolCalls.map((tc) => (
              <div
                key={tc.call_id}
                className="rounded-xl border border-fuchsia-400/15 bg-fuchsia-400/[0.06] px-3 py-2 font-mono text-[11px] text-ink-200"
              >
                <div className="text-fuchsia-300 font-semibold flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>{tc.name}</span>
                  <span className="text-ink-400">
                    (
                    {Object.entries(tc.args)
                      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                      .join(", ")}
                    )
                  </span>
                </div>
                {tc.result !== undefined && (
                  <div className="mt-1 text-ink-300 whitespace-pre-wrap">
                    <span className="text-emerald-400">↳ </span>
                    {tc.result}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
