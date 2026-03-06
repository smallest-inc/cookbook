"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Waveform from "./Waveform";

/**
 * Cartoon-style Greek philosopher SVG with lip-sync.
 */
export default function PhilosopherAvatar({
  name,
  subtitle,
  isSpeaking = false,
  side = "socrates",
  player = null,
  emotion = null,
  size = "normal", // "normal" for debate, "small" for idle landing
}) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    if (!isSpeaking) {
      setMouthOpen(0);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const update = () => {
      if (player) {
        const freq = player.getFrequencyData();
        if (freq.length > 0) {
          let sum = 0;
          const n = Math.min(freq.length, 8);
          for (let i = 0; i < n; i++) sum += freq[i];
          setMouthOpen(sum / n / 255);
        } else {
          simMouth();
        }
      } else {
        simMouth();
      }
      animRef.current = requestAnimationFrame(update);
    };
    const simMouth = () => {
      const t = Date.now() / 100;
      setMouthOpen(0.3 + Math.sin(t) * 0.25 + Math.random() * 0.12);
    };
    update();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isSpeaking, player]);

  const isSoc = side === "socrates";
  const w = size === "small" ? "w-20 h-20" : "w-28 h-28";
  const ringColor = isSoc ? "rgba(201,168,76,0.12)" : "rgba(139,157,122,0.12)";
  const glowClass = isSoc ? "bg-gold/20" : "bg-olive/20";
  const borderActive = isSoc ? "border-gold/40" : "border-olive/40";
  const borderDim = isSoc ? "border-gold/8" : "border-olive/8";
  const textActive = isSoc ? "text-gold" : "text-olive";

  const mouthRy = 1 + mouthOpen * 6;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {isSpeaking && [1, 2, 3].map((ring) => (
          <div key={ring} className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: ringColor, transform: `scale(${1 + ring * 0.18})`, opacity: 0.35 - ring * 0.1, animation: `pulse-ring 2.5s ease-out ${ring * 0.3}s infinite` }} />
        ))}
        <div className={`absolute inset-0 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${glowClass} ${isSpeaking ? "opacity-70" : "opacity-0"}`} style={{ transform: "scale(1.6)" }} />

        <motion.div animate={{ scale: isSpeaking ? 1.05 : 1 }} transition={{ duration: 0.3 }}
          className={`relative ${w} rounded-full glass-gold-strong flex items-center justify-center border-2 overflow-hidden ${isSpeaking ? borderActive : borderDim}`}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* BG */}
            <circle cx="50" cy="50" r="50" fill={isSoc ? "rgba(201,168,76,0.06)" : "rgba(139,157,122,0.06)"} />

            {isSoc ? <SocratesFace mouthRy={mouthRy} speaking={isSpeaking} mouthOpen={mouthOpen} /> : <AristotleFace mouthRy={mouthRy} speaking={isSpeaking} mouthOpen={mouthOpen} />}
          </svg>
        </motion.div>
      </div>

      {size !== "small" && (
        <>
          <div className="text-center">
            <div className={`font-display text-base font-semibold tracking-wider transition-colors duration-300 ${isSpeaking ? textActive : "text-cream/30"}`}>{name}</div>
            <div className="text-[10px] text-cream/20 tracking-wider mt-0.5 italic font-display">{subtitle}</div>
            {emotion && isSpeaking && (
              <motion.div key={emotion} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                className={`mt-1 text-[9px] tracking-wider uppercase font-display ${isSoc ? "text-gold/40" : "text-olive/40"}`}>{emotion}</motion.div>
            )}
          </div>
          <Waveform player={player} isActive={isSpeaking} color={isSoc ? "gold" : "olive"} />
        </>
      )}
    </div>
  );
}

/* Socrates: bald, white side hair, big white beard, toga */
function SocratesFace({ mouthRy, speaking, mouthOpen }) {
  return (
    <g>
      {/* Toga / shoulders */}
      <path d="M20 95 Q25 72 35 68 Q50 62 65 68 Q75 72 80 95" fill="#9ab8c4" />
      <path d="M25 95 Q28 76 38 72 Q50 66 62 72 Q72 76 75 95" fill="#b5d1db" />
      {/* Toga fold line */}
      <path d="M42 72 Q48 78 55 72" stroke="#8aa8b4" strokeWidth="0.8" fill="none" />

      {/* Neck */}
      <rect x="42" y="58" width="16" height="14" rx="6" fill="#e8b888" />

      {/* Head */}
      <ellipse cx="50" cy="42" rx="22" ry="24" fill="#e8b888" />

      {/* Bald top + side hair */}
      <ellipse cx="50" cy="32" rx="20" ry="14" fill="#e8b888" />
      {/* Side hair - left */}
      <path d="M28 35 Q26 45 28 55 Q30 52 32 42 Q30 38 28 35" fill="#d0d0d0" />
      <path d="M30 36 Q28 44 30 52 Q32 48 33 40 Q32 37 30 36" fill="#e0e0e0" />
      {/* Side hair - right */}
      <path d="M72 35 Q74 45 72 55 Q70 52 68 42 Q70 38 72 35" fill="#d0d0d0" />
      <path d="M70 36 Q72 44 70 52 Q68 48 67 40 Q68 37 70 36" fill="#e0e0e0" />

      {/* Eyebrows - bushy white */}
      <path d={speaking && mouthOpen > 0.4 ? "M35 34 Q40 30 46 34" : "M35 35 Q40 32 46 35"} stroke="#d0d0d0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={speaking && mouthOpen > 0.4 ? "M54 34 Q60 30 65 34" : "M54 35 Q60 32 65 35"} stroke="#d0d0d0" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Eyes */}
      <ellipse cx="41" cy="40" rx="4" ry="4.5" fill="white" />
      <ellipse cx="59" cy="40" rx="4" ry="4.5" fill="white" />
      <circle cx={speaking ? "42" : "41"} cy="40" r="2.5" fill="#5a4a30" />
      <circle cx={speaking ? "60" : "59"} cy="40" r="2.5" fill="#5a4a30" />
      <circle cx={speaking ? "42.5" : "41"} cy="39.5" r="1" fill="#1a1a1a" />
      <circle cx={speaking ? "60.5" : "59"} cy="39.5" r="1" fill="#1a1a1a" />
      {/* Eye shine */}
      <circle cx="42.5" cy="38.5" r="0.6" fill="white" opacity="0.8" />
      <circle cx="60.5" cy="38.5" r="0.6" fill="white" opacity="0.8" />

      {/* Nose - rounded */}
      <ellipse cx="50" cy="48" rx="3" ry="2.5" fill="#d4a070" />

      {/* Big white beard */}
      <path d="M32 52 Q34 48 40 50 Q50 46 60 50 Q66 48 68 52 Q70 60 68 70 Q64 78 50 80 Q36 78 32 70 Q30 60 32 52" fill="#e8e8e8" />
      <path d="M34 54 Q36 50 42 52 Q50 48 58 52 Q64 50 66 54 Q68 62 66 68 Q62 74 50 76 Q38 74 34 68 Q32 62 34 54" fill="#f0f0f0" />
      {/* Beard texture lines */}
      <path d="M42 58 Q44 65 42 72" stroke="#d8d8d8" strokeWidth="0.5" fill="none" />
      <path d="M50 56 Q50 65 50 74" stroke="#d8d8d8" strokeWidth="0.5" fill="none" />
      <path d="M58 58 Q56 65 58 72" stroke="#d8d8d8" strokeWidth="0.5" fill="none" />

      {/* Mustache */}
      <path d="M40 52 Q45 50 50 52 Q55 50 60 52 Q58 54 50 54 Q42 54 40 52" fill="#e0e0e0" />

      {/* Mouth opening in beard */}
      <ellipse cx="50" cy="55" rx={3 + mouthOpen * 2} ry={mouthRy} fill={speaking ? "#7a2a2a" : "#d8a070"} />
      {speaking && mouthOpen > 0.25 && <ellipse cx="50" cy="54" rx={2 + mouthOpen} ry={Math.min(mouthRy - 1, 2.5)} fill="rgba(255,255,255,0.6)" />}

      {/* Ears */}
      <ellipse cx="28" cy="42" rx="3" ry="5" fill="#e0a878" />
      <ellipse cx="72" cy="42" rx="3" ry="5" fill="#e0a878" />
    </g>
  );
}

/* Aristotle: brown curly hair, trimmed beard, toga */
function AristotleFace({ mouthRy, speaking, mouthOpen }) {
  return (
    <g>
      {/* Toga */}
      <path d="M20 95 Q25 72 35 68 Q50 62 65 68 Q75 72 80 95" fill="#4a6a8a" />
      <path d="M25 95 Q28 76 38 72 Q50 66 62 72 Q72 76 75 95" fill="#e8dcc8" />
      {/* Blue toga drape */}
      <path d="M38 72 Q35 80 32 95 L55 95 Q52 82 48 74" fill="#5a7a9a" opacity="0.7" />
      <path d="M40 74 Q38 82 36 95 L50 95 Q48 84 46 76" fill="#6a8aaa" opacity="0.5" />

      {/* Neck */}
      <rect x="42" y="58" width="16" height="14" rx="6" fill="#d4a070" />

      {/* Head */}
      <ellipse cx="50" cy="42" rx="22" ry="24" fill="#d4a070" />

      {/* Curly brown hair */}
      <path d="M28 38 Q26 28 32 22 Q38 16 50 15 Q62 16 68 22 Q74 28 72 38 Q70 32 64 26 Q56 20 50 19 Q44 20 36 26 Q30 32 28 38" fill="#5a3a1a" />
      {/* Hair volume/curls */}
      <circle cx="32" cy="26" r="4" fill="#6a4a2a" />
      <circle cx="40" cy="20" r="4.5" fill="#6a4a2a" />
      <circle cx="50" cy="18" r="4.5" fill="#5a3a1a" />
      <circle cx="60" cy="20" r="4.5" fill="#6a4a2a" />
      <circle cx="68" cy="26" r="4" fill="#6a4a2a" />
      <circle cx="28" cy="34" r="3.5" fill="#5a3a1a" />
      <circle cx="72" cy="34" r="3.5" fill="#5a3a1a" />

      {/* Eyebrows */}
      <path d={speaking && mouthOpen > 0.4 ? "M35 34 Q40 31 46 34" : "M35 35 Q40 33 46 36"} stroke="#4a3020" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={speaking && mouthOpen > 0.4 ? "M54 34 Q60 31 65 34" : "M54 35 Q60 33 65 36"} stroke="#4a3020" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Eyes */}
      <ellipse cx="41" cy="40" rx="4" ry="4.5" fill="white" />
      <ellipse cx="59" cy="40" rx="4" ry="4.5" fill="white" />
      <circle cx={speaking ? "41.5" : "41"} cy="40" r="2.5" fill="#3a5a7a" />
      <circle cx={speaking ? "59.5" : "59"} cy="40" r="2.5" fill="#3a5a7a" />
      <circle cx={speaking ? "42" : "41"} cy="39.5" r="1" fill="#1a1a1a" />
      <circle cx={speaking ? "60" : "59"} cy="39.5" r="1" fill="#1a1a1a" />
      <circle cx="42" cy="38.5" r="0.6" fill="white" opacity="0.8" />
      <circle cx="60" cy="38.5" r="0.6" fill="white" opacity="0.8" />

      {/* Nose */}
      <path d="M50 43 L48 49 Q50 50 52 49 Z" fill="#c49060" />

      {/* Trimmed beard */}
      <path d="M34 52 Q36 50 42 51 Q50 48 58 51 Q64 50 66 52 Q68 58 66 64 Q62 70 50 72 Q38 70 34 64 Q32 58 34 52" fill="#5a3a1a" />
      <path d="M36 54 Q38 52 44 53 Q50 50 56 53 Q62 52 64 54 Q66 58 64 62 Q60 66 50 68 Q40 66 36 62 Q34 58 36 54" fill="#6a4a2a" />

      {/* Mustache */}
      <path d="M40 52 Q45 50 50 52 Q55 50 60 52 Q58 54 50 54 Q42 54 40 52" fill="#5a3a1a" />

      {/* Mouth opening in beard */}
      <ellipse cx="50" cy="56" rx={3 + mouthOpen * 2} ry={mouthRy} fill={speaking ? "#7a2a2a" : "#c49060"} />
      {speaking && mouthOpen > 0.25 && <ellipse cx="50" cy="55" rx={2 + mouthOpen} ry={Math.min(mouthRy - 1, 2.5)} fill="rgba(255,255,255,0.6)" />}

      {/* Ears */}
      <ellipse cx="28" cy="42" rx="3" ry="5" fill="#c89868" />
      <ellipse cx="72" cy="42" rx="3" ry="5" fill="#c89868" />
    </g>
  );
}
