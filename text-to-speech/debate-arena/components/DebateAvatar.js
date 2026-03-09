"use client";

import { motion } from "framer-motion";
import Waveform from "./Waveform";

export default function DebateAvatar({
  label,
  subtitle,
  isSpeaking = false,
  side = "socrates",
  player = null,
}) {
  const isSocrates = side === "socrates";
  const accentColor = isSocrates ? "gold" : "olive";
  const borderActive = isSocrates
    ? "border-gold/40"
    : "border-olive/40";
  const borderDim = isSocrates
    ? "border-gold/8"
    : "border-olive/8";
  const textActive = isSocrates ? "text-gold" : "text-olive";
  const ringColor = isSocrates
    ? "rgba(201,168,76,0.12)"
    : "rgba(139,157,122,0.12)";
  const initial = isSocrates ? "S" : "A";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar */}
      <div className="relative">
        {/* Pulse rings */}
        {isSpeaking &&
          [1, 2, 3].map((ring) => (
            <div
              key={ring}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: ringColor,
                transform: `scale(${1 + ring * 0.18})`,
                opacity: 0.35 - ring * 0.1,
                animation: `pulse-ring 2.5s ease-out ${ring * 0.3}s infinite`,
              }}
            />
          ))}

        {/* Glow */}
        <div
          className={`absolute inset-0 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
            isSocrates ? "bg-gold/20" : "bg-olive/20"
          } ${isSpeaking ? "opacity-70" : "opacity-0"}`}
          style={{ transform: "scale(1.6)" }}
        />

        {/* Circle */}
        <motion.div
          animate={{
            scale: isSpeaking ? 1.06 : 1,
            borderColor: isSpeaking
              ? isSocrates
                ? "rgba(201,168,76,0.5)"
                : "rgba(139,157,122,0.5)"
              : "rgba(201,168,76,0.06)",
          }}
          transition={{ duration: 0.4 }}
          className={`relative w-24 h-24 rounded-full glass-gold-strong flex items-center justify-center border-2 ${
            isSpeaking ? borderActive : borderDim
          }`}
        >
          <span
            className={`font-display text-3xl font-bold transition-colors duration-300 ${
              isSpeaking ? textActive : "text-cream/20"
            }`}
          >
            {initial}
          </span>
        </motion.div>
      </div>

      {/* Name */}
      <div className="text-center">
        <div
          className={`font-display text-base font-semibold tracking-wider transition-colors duration-300 ${
            isSpeaking ? textActive : "text-cream/30"
          }`}
        >
          {label}
        </div>
        <div className="text-[10px] text-cream/20 tracking-wider mt-0.5 italic font-display">
          {subtitle}
        </div>
      </div>

      {/* Waveform */}
      <Waveform player={player} isActive={isSpeaking} color={accentColor} />
    </div>
  );
}
