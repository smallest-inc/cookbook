"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const CHARS_PER_SEC = 14; // rough speaking rate, used until the full audio length is known

/**
 * Big word-by-word caption for whoever is speaking.
 * Word timing is spread over the real audio length in proportion to word length,
 * so it stays in sync with the voice without needing timestamps from the API.
 */
export default function LiveCaption({ text, player, name, color = "gold", active, cutAt = null }) {
  const words = useMemo(() => (text ? text.split(/\s+/).filter(Boolean) : []), [text]);
  const bounds = useMemo(() => {
    const weights = words.map((w) => w.length + 2);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return weights.map((w) => {
      const start = acc / total;
      acc += w;
      return start;
    });
  }, [words]);
  const [idx, setIdx] = useState(-1);
  const raf = useRef(null);

  useEffect(() => {
    setIdx(-1);
    if (!active || !player || !words.length) return;
    const tick = () => {
      const { elapsed, total, done } = player.progress();
      const length = done ? total : Math.max(total, (text.length || 1) / CHARS_PER_SEC);
      const frac = length > 0 ? elapsed / length : 0;
      let i = -1;
      for (let k = 0; k < bounds.length; k++) if (bounds[k] <= frac) i = k;
      setIdx(i);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, player, words, bounds, text]);

  if (!active || !words.length) return null;

  // Show a window of about 9 words around the current one, so it reads like a subtitle.
  // Once cut off, show the last words they got out, not an empty window.
  const cur = Math.max(0, idx);
  const start = cutAt !== null ? Math.max(0, cutAt - 8) : Math.max(0, Math.floor(cur / 8) * 8);
  const end = cutAt !== null ? cutAt : start + 9;
  const shown = words.slice(start, end);
  const accent = color === "gold" ? "text-gold-bright" : "text-[#b6d39b]";
  const dot = color === "gold" ? "bg-gold" : "bg-olive";

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/55 px-5 py-4 backdrop-blur-md">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-cream/50">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {name}
      </div>
      <p className="text-[22px] font-semibold leading-snug sm:text-2xl">
        {shown.map((w, i) => {
          const k = start + i;
          const said = k <= idx;
          return (
            <span key={k} className={`${said ? accent : "text-cream/25"} transition-colors duration-100`}>
              {w}{" "}
            </span>
          );
        })}
        {cutAt !== null && idx >= cutAt - 1 && <span className={accent}>...</span>}
      </p>
    </div>
  );
}
