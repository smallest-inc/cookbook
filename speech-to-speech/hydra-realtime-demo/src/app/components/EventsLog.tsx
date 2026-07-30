"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { LoggedEvent } from "@/app/types";

const HIGH_VOLUME = new Set([
  "input_audio_buffer.append",
  "response.output_audio.delta",
]);

function summarize(evt: Record<string, unknown>): string {
  const t = evt.type as string;
  if (!t) return "";
  if (t === "session.configured" || t === "session.created") {
    const s = (evt.session as Record<string, unknown>) || {};
    const parts = [];
    if (s.voice) parts.push(`voice=${s.voice}`);
    if (s.output_audio_sample_rate)
      parts.push(`${s.output_audio_format}/${s.output_audio_sample_rate}`);
    if (evt.session_id)
      parts.push(`sid=${String(evt.session_id).slice(0, 8)}`);
    return parts.join(" · ");
  }
  if (t === "input_audio_buffer.speech_started")
    return `@${evt.audio_start_ms}ms · ${evt.item_id}`;
  if (t === "input_audio_buffer.speech_stopped")
    return `@${evt.audio_end_ms}ms · ${evt.item_id}`;
  if (t === "conversation.item.added" || t === "conversation.item.done") {
    const it = (evt.item as Record<string, unknown>) || {};
    return `${it.role || it.type || "?"} · ${it.id || ""}`;
  }
  if (t === "response.done") {
    const r = (evt.response as Record<string, unknown>) || {};
    const u = (r.usage as Record<string, unknown>) || {};
    const parts = [String(r.status || "?")];
    const sd = r.status_details as { reason?: string } | undefined;
    if (sd?.reason) parts.push(sd.reason);
    if (u.total_tokens)
      parts.push(
        `${u.input_tokens}+${u.output_tokens}=${u.total_tokens}tok`,
      );
    return parts.join(" · ");
  }
  if (t === "response.created") {
    const r = (evt.response as Record<string, unknown>) || {};
    return String(r.id || "");
  }
  if (t === "response.output_audio.delta") {
    return `${Math.round(((evt.delta as string) || "").length * 0.75)}B`;
  }
  if (t === "input_audio_buffer.append") {
    return `${Math.round(((evt.audio as string) || "").length * 0.75)}B`;
  }
  if (t === "response.function_call_arguments.done") {
    return `${evt.name} ${String(evt.arguments || "").slice(0, 60)}`;
  }
  if (t === "session.configure" || t === "session.update") {
    return Object.keys((evt.session as object) || {}).join(", ");
  }
  if (t === "conversation.item.create") {
    return String((evt.item as Record<string, unknown>)?.type || "");
  }
  if (t === "error") {
    const e = (evt.error as Record<string, unknown>) || {};
    return `[${e.code || "?"}] ${e.message || ""}`;
  }
  return "";
}

export interface EventsLogProps {
  events: LoggedEvent[];
  onClear: () => void;
}

export default function EventsLog({ events, onClear }: EventsLogProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [showAudio, setShowAudio] = useState(false);
  const [selected, setSelected] = useState<LoggedEvent | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (near) el.scrollTop = el.scrollHeight;
  }, [events]);

  const filtered = showAudio
    ? events
    : events.filter((e) => !HIGH_VOLUME.has(e.type));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-ink-700 flex items-center gap-3">
        <div className="h-2 w-2 bg-ink-100 animate-pulse" />
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-300">
          Events
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-ink-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showAudio}
            onChange={(e) => setShowAudio(e.target.checked)}
            className="accent-ink-100"
          />
          show audio
        </label>
        <button
          className="text-[10px] font-mono uppercase tracking-widest text-ink-400 hover:text-ink-100 border border-ink-700 hover:border-ink-500 px-2 py-0.5"
          onClick={onClear}
        >
          clear
        </button>
      </div>

      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto scroll font-mono text-[11px]">
        {filtered.map((e) => {
          const sum = summarize(e.raw as Record<string, unknown>);
          const isErr = e.type === "error";
          return (
            <button
              key={e.id}
              onClick={() => setSelected((cur) => (cur?.id === e.id ? null : e))}
              className={clsx(
                "w-full text-left grid grid-cols-[18px_56px_180px_1fr] gap-2 px-3 py-1 items-baseline border-l-2 transition",
                e.dir === "out"
                  ? "border-ink-300 hover:bg-ink-800"
                  : "border-ink-700 hover:bg-ink-900",
                isErr && "bg-ink-800 border-ink-100",
                selected?.id === e.id && "bg-ink-800",
              )}
            >
              <span
                className={clsx(
                  "text-center font-semibold",
                  e.dir === "out" ? "text-ink-100" : "text-ink-400",
                  isErr && "text-ink-100",
                )}
              >
                {e.dir === "out" ? "→" : "←"}
              </span>
              <span className="text-right text-ink-400/70 text-[10px]">
                {e.ts.toFixed(0)}ms
              </span>
              <span
                className={clsx(
                  "truncate",
                  isErr ? "text-ink-100" : "text-ink-100",
                )}
              >
                {e.type}
              </span>
              <span className="truncate text-ink-400/70 text-[10px]">
                {sum}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-ink-400/70 italic text-xs py-8">
            No events yet.
          </div>
        )}
      </div>

      {selected && (
        <div className="border-t border-ink-700 bg-ink-950 max-h-[180px] overflow-y-auto scroll">
          <div className="px-3 py-1.5 flex items-center gap-2 border-b border-ink-700">
            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-300">
              {selected.dir === "out" ? "sent" : "received"} · {selected.type}
            </span>
            <button
              className="ml-auto text-[10px] text-ink-400 hover:text-ink-100"
              onClick={() => setSelected(null)}
            >
              close
            </button>
          </div>
          <pre className="px-3 py-2 text-[10px] text-ink-200 whitespace-pre-wrap break-words">
            {JSON.stringify(selected.raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
