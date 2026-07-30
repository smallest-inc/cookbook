"use client";

import clsx from "clsx";
import type { HydraStatus } from "@/app/lib/hydra-client";

export interface TopbarProps {
  status: HydraStatus;
  sessionId: string | null;
  micMuted: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
}

const STATUS_LABEL: Record<HydraStatus, string> = {
  idle: "Disconnected",
  connecting: "Connecting",
  open: "Live",
  closing: "Closing",
  closed: "Disconnected",
  error: "Error",
};

export default function Topbar(props: TopbarProps) {
  const live = props.status === "open";

  return (
    <div className="h-14 flex-shrink-0 flex items-center gap-4 px-5 border-b border-ink-700 bg-ink-950">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 border border-ink-600 bg-ink-900 grid place-items-center text-[11px] font-mono font-semibold text-ink-100">
          H
        </div>
        <div className="leading-tight">
          <div className="text-sm font-mono font-semibold tracking-tight text-ink-100">
            Hydra <span className="text-ink-400 font-normal">Realtime</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-400">
            by smallest.ai
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2">
        <span
          className={clsx(
            "h-2 w-2",
            live && "bg-ink-100 animate-pulse",
            props.status === "connecting" && "bg-ink-300 animate-pulse",
            (props.status === "closed" || props.status === "idle") &&
              "bg-ink-600",
            props.status === "error" && "bg-ink-400 animate-pulse",
          )}
        />
        <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-ink-300">
          {STATUS_LABEL[props.status]}
        </span>
        {props.sessionId && (
          <span className="ml-2 text-[10px] font-mono text-ink-400 truncate max-w-[140px]">
            {props.sessionId}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <a
          href="https://github.com/smallest-inc/hydra_agents"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-mono uppercase tracking-widest text-ink-400 hover:text-ink-100 px-3 py-1.5 border border-ink-700 hover:border-ink-500 transition"
        >
          GitHub
        </a>
        {live && (
          <button
            onClick={props.onToggleMute}
            className={clsx(
              "btn",
              props.micMuted && "btn-danger",
            )}
          >
            {props.micMuted ? "Unmute mic" : "Mute mic"}
          </button>
        )}
        {live ? (
          <button onClick={props.onDisconnect} className="btn btn-danger">
            Disconnect
          </button>
        ) : (
          <button onClick={props.onConnect} className="btn btn-primary">
            {props.status === "connecting" ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}
