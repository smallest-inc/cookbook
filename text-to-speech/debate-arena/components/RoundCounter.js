"use client";

import { motion } from "framer-motion";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export default function RoundCounter({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="flex gap-2">
        {Array.from({ length: total }, (_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.06 }}
            className={`w-2 h-2 rounded-full transition-all duration-500 ${
              i < current
                ? "bg-gold shadow-sm shadow-gold/30"
                : "bg-cream/[0.06]"
            }`}
          />
        ))}
      </div>
      <span className="font-display text-sm text-cream/25 tracking-wider italic">
        Round {ROMAN[current - 1] || current} of {ROMAN[total - 1] || total}
      </span>
    </div>
  );
}
