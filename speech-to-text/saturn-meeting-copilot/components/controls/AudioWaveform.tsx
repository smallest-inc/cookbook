"use client";

import { motion } from "framer-motion";

interface AudioWaveformProps {
  active: boolean;
}

const BAR_COUNT = 16;

export function AudioWaveform({ active }: AudioWaveformProps) {
  return (
    <div className="flex items-center gap-[2px] h-full w-full">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <motion.div
          key={i}
          className={`flex-1 rounded-full ${
            active ? "bg-violet-400/70" : "bg-white/15"
          }`}
          animate={
            active
              ? {
                  height: [
                    `${20 + Math.random() * 60}%`,
                    `${30 + Math.random() * 50}%`,
                    `${15 + Math.random() * 70}%`,
                    `${25 + Math.random() * 55}%`,
                  ],
                }
              : { height: "20%" }
          }
          transition={
            active
              ? {
                  duration: 0.6 + Math.random() * 0.4,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: i * 0.04,
                  ease: "easeInOut",
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}
