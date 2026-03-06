"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 24;

export default function Waveform({ player, isActive, color = "gold" }) {
  const [bars, setBars] = useState(() => new Array(BAR_COUNT).fill(4));
  const animRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      setBars(new Array(BAR_COUNT).fill(4));
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const update = () => {
      if (player) {
        const freq = player.getFrequencyData();
        if (freq.length > 0) {
          const step = Math.max(1, Math.floor(freq.length / BAR_COUNT));
          const newBars = [];
          for (let i = 0; i < BAR_COUNT; i++) {
            const idx = Math.min(i * step, freq.length - 1);
            newBars.push(4 + (freq[idx] / 255) * 36);
          }
          setBars(newBars);
        } else {
          simulatedBars();
        }
      } else {
        simulatedBars();
      }
      animRef.current = requestAnimationFrame(update);
    };

    const simulatedBars = () => {
      const t = Date.now() / 120;
      const newBars = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const wave =
          Math.sin(t + i * 0.4) * 0.3 +
          Math.sin(t * 1.3 + i * 0.7) * 0.2 +
          0.5;
        newBars.push(4 + wave * 28 + Math.random() * 4);
      }
      setBars(newBars);
    };

    update();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isActive, player]);

  const barActive =
    color === "gold" ? "bg-gold" : "bg-olive";
  const barGlow =
    color === "gold" ? "shadow-gold/40" : "shadow-olive/40";

  return (
    <div className="flex items-end justify-center gap-[3px] h-10">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-75 ${
            isActive
              ? `${barActive} shadow-sm ${barGlow}`
              : "bg-cream/[0.06]"
          }`}
          style={{ height: isActive ? `${h}px` : "4px" }}
        />
      ))}
    </div>
  );
}
