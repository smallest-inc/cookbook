"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { trackAudioPlay } from "@/lib/analytics";

function seededBars(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b) + i) | 0;
    bars.push(0.3 + ((((h >>> 0) % 1000) / 1000) * 0.7));
  }
  return bars;
}

interface AudioPlayerProps {
  src: string;
  label: string;
  projectSlug: string;
}

export function AudioPlayer({ src, label, projectSlug }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = useMemo(() => seededBars(label + src, 32), [label, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      trackAudioPlay(projectSlug, label);
    }
    setIsPlaying(!isPlaying);
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{label}</span>
          </div>

          <div
            className="flex h-8 cursor-pointer items-end gap-[2px]"
            onClick={handleBarClick}
            role="slider"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
          >
            {bars.map((height, i) => {
              const barProgress = i / bars.length;
              const isActive = barProgress <= progress;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors duration-150 ${
                    isActive ? "bg-foreground" : "bg-muted"
                  }`}
                  style={{
                    height: `${height * 100}%`,
                    minHeight: 4,
                  }}
                />
              );
            })}
          </div>

          {duration > 0 && (
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{formatTime(progress * duration)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
