"use client";

import clsx from "clsx";
import type { OrbState } from "@/app/types";

export interface OrbProps {
  state: OrbState;
  level: number;
  onClick: () => void;
  label: string;
}

const STATE_LABEL: Record<OrbState, string> = {
  idle: "Tap to connect",
  connecting: "Connecting…",
  connected: "Speak naturally",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Error",
};

export default function Orb({ state, level, onClick, label }: OrbProps) {
  const scale = 1 + level * 0.06;
  const ringOpacity = state === "idle" ? 0.25 : 0.5 + level * 0.3;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <div
        className="relative h-[260px] w-[260px] flex items-center justify-center cursor-pointer"
        onClick={onClick}
      >
        <div
          className="orb-ring transition-opacity duration-300"
          style={{ opacity: ringOpacity }}
        />
        <div
          className={clsx(
            "orb-core h-[200px] w-[200px]",
            state === "listening" && "listening",
            state === "speaking" && "speaking",
            state === "thinking" && "thinking animate-orb-pulse",
            state === "idle" && "idle",
            state === "connecting" && "animate-orb-pulse",
            state === "error" && "idle",
          )}
          style={{
            transform: `scale(${scale})`,
            transition: "transform 80ms linear",
          }}
        />
        <div className="absolute h-1.5 w-1.5 bg-ink-100 pointer-events-none" />
      </div>

      <div className="mt-8 text-center">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-ink-300">
          {STATE_LABEL[state]}
        </div>
        <div className="mt-1 text-sm text-ink-400 max-w-[420px]">{label}</div>
      </div>
    </div>
  );
}
