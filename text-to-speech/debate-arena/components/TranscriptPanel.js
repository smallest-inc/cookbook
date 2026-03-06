"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export default function TranscriptPanel({ entries, side }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const isSocrates = side === "socrates";
  const labelColor = isSocrates ? "text-gold/35" : "text-olive/40";
  const borderColor = isSocrates ? "border-gold/8" : "border-olive/8";

  if (entries.length === 0) {
    return (
      <div className="glass-gold rounded-xl p-4 min-h-[80px] flex items-center justify-center">
        <span className="text-cream/10 text-xs font-display italic">
          Awaiting oration...
        </span>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="space-y-2 overflow-y-auto max-h-56 pr-1">
      <AnimatePresence>
        {entries.map((entry, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`glass-gold rounded-xl p-3 border ${borderColor}`}
          >
            <div
              className={`text-[9px] font-display font-semibold uppercase tracking-[0.2em] mb-1.5 ${labelColor}`}
            >
              Round {ROMAN[i] || i + 1}
            </div>
            <p className="text-[13px] leading-relaxed text-cream/55 font-body">
              {entry}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
