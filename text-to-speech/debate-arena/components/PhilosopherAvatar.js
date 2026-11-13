"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Waveform from "./Waveform";

/**
 * Cartoon philosopher with a mouth driven by the real audio level,
 * blinking, a small head bob while talking, and reactions while listening
 * (eye-rolls and raised brows when the other side is talking).
 */
export default function PhilosopherAvatar({
  name,
  subtitle,
  isSpeaking = false,
  isListening = false,
  side = "socrates",
  player = null,
  emotion = null,
  size = "normal", // "normal" | "large" for debate, "small" for idle landing
}) {
  const [face, setFace] = useState({ mouth: 0, blink: 0, look: [0, 0], brow: 0, bob: 0 });
  const st = useRef({ mouth: 0, blinkUntil: 0, nextBlink: 0, react: null, nextReact: 0 });
  const raf = useRef(null);

  useEffect(() => {
    const s = st.current;
    const loop = () => {
      const now = performance.now();
      // Mouth: fast attack, slower release, so it reads as speech and not jitter.
      const target = isSpeaking && player ? player.getLevel() : 0;
      s.mouth += (target - s.mouth) * (target > s.mouth ? 0.55 : 0.18);
      // Blink every 2.5 to 5 s.
      if (now > s.nextBlink) {
        s.blinkUntil = now + 120;
        s.nextBlink = now + 2500 + Math.random() * 2500;
      }
      const blink = now < s.blinkUntil ? 1 : 0;
      // Listening reactions every 3 to 5 s: eye-roll or a raised brow.
      if (isListening && now > s.nextReact) {
        s.react = { kind: Math.random() < 0.55 ? "roll" : "brow", until: now + 900 };
        s.nextReact = now + 3000 + Math.random() * 2000;
      }
      if (!isListening) s.react = null;
      let look = isSpeaking ? [0.8, 0] : [0, 0];
      let brow = isSpeaking ? Math.min(1, s.mouth * 1.6) : 0;
      if (s.react && now < s.react.until) {
        const p = 1 - (s.react.until - now) / 900;
        if (s.react.kind === "roll") look = [Math.cos(Math.PI * p) * 1.4, -1.6 * Math.sin(Math.PI * p)];
        else brow = Math.sin(Math.PI * p);
      }
      const bob = isSpeaking ? Math.sin(now / 160) * s.mouth * 2.2 : 0;
      // Only re-render when the face visibly changes, so idle avatars stay quiet between blinks.
      const next = { mouth: s.mouth, blink, look, brow, bob };
      const prev = s.last;
      const moved = (x, y) => Math.abs(x - y) > 0.01;
      if (!prev || blink !== prev.blink || moved(next.mouth, prev.mouth) || moved(brow, prev.brow) ||
          moved(bob, prev.bob) || moved(look[0], prev.look[0]) || moved(look[1], prev.look[1])) {
        s.last = next;
        setFace(next);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [isSpeaking, isListening, player]);

  const isSoc = side === "socrates";
  const w = size === "small" ? "w-20 h-20" : size === "large" ? "w-32 h-32 sm:w-36 sm:h-36" : "w-28 h-28";
  const ringColor = isSoc ? "rgba(201,168,76,0.12)" : "rgba(139,157,122,0.12)";
  const glowClass = isSoc ? "bg-gold/20" : "bg-olive/20";
  const borderActive = isSoc ? "border-gold/50" : "border-olive/50";
  const borderDim = isSoc ? "border-gold/10" : "border-olive/10";
  const textActive = isSoc ? "text-gold" : "text-olive";
  const props = { mouthOpen: face.mouth, speaking: isSpeaking, blink: face.blink, look: face.look, brow: face.brow };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {isSpeaking &&
          [1, 2, 3].map((ring) => (
            <div
              key={ring}
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ background: ringColor, transform: `scale(${1 + ring * 0.18})`, opacity: 0.35 - ring * 0.1, animation: `pulse-ring 2.5s ease-out ${ring * 0.3}s infinite` }}
            />
          ))}
        <div
          className={`pointer-events-none absolute inset-0 rounded-full blur-3xl transition-opacity duration-500 ${glowClass} ${isSpeaking ? "opacity-70" : "opacity-0"}`}
          style={{ transform: "scale(1.6)" }}
        />
        <motion.div
          animate={{ scale: isSpeaking ? 1.06 : 1 }}
          transition={{ duration: 0.25 }}
          className={`relative ${w} glass-gold-strong flex items-center justify-center overflow-hidden rounded-full border-2 ${isSpeaking ? borderActive : borderDim}`}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <circle cx="50" cy="50" r="50" fill={isSoc ? "rgba(201,168,76,0.06)" : "rgba(139,157,122,0.06)"} />
            <g transform={`translate(0 ${face.bob.toFixed(2)}) rotate(${(face.bob * 0.8).toFixed(2)} 50 60)`}>
              {isSoc ? <SocratesFace {...props} /> : <AristotleFace {...props} />}
            </g>
          </svg>
        </motion.div>
      </div>

      {size !== "small" && (
        <>
          <div className="text-center">
            <div className={`font-display text-lg font-semibold tracking-wider transition-colors duration-300 ${isSpeaking ? textActive : "text-cream/40"}`}>{name}</div>
            <div className="mt-0.5 font-display text-[11px] italic tracking-wider text-cream/30">{subtitle}</div>
            {emotion && isSpeaking && (
              <motion.div key={emotion} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className={`mt-1 font-display text-[10px] uppercase tracking-wider ${isSoc ? "text-gold/50" : "text-olive/50"}`}>
                {emotion}
              </motion.div>
            )}
          </div>
          <Waveform player={player} isActive={isSpeaking} color={isSoc ? "gold" : "olive"} />
        </>
      )}
    </div>
  );
}

function Eyes({ blink, look, iris, speaking }) {
  const ry = 4.5 * (1 - blink * 0.9);
  const [dx, dy] = look;
  return (
    <g>
      <ellipse cx="41" cy="40" rx="4" ry={ry} fill="white" />
      <ellipse cx="59" cy="40" rx="4" ry={ry} fill="white" />
      {blink < 0.5 && (
        <>
          <circle cx={41 + dx} cy={40 + dy} r="2.5" fill={iris} />
          <circle cx={59 + dx} cy={40 + dy} r="2.5" fill={iris} />
          <circle cx={41.3 + dx} cy={39.6 + dy} r="1" fill="#1a1a1a" />
          <circle cx={59.3 + dx} cy={39.6 + dy} r="1" fill="#1a1a1a" />
          <circle cx={42.2 + dx} cy={38.6 + dy} r="0.6" fill="white" opacity="0.8" />
          <circle cx={60.2 + dx} cy={38.6 + dy} r="0.6" fill="white" opacity="0.8" />
        </>
      )}
    </g>
  );
}

function Brows({ brow, color, width }) {
  const up = brow * 3;
  return (
    <g>
      <path d={`M35 ${35 - up} Q40 ${31.5 - up} 46 ${35 - up * 0.6}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
      <path d={`M54 ${35 - up * 0.6} Q60 ${31.5 - up} 65 ${35 - up}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Mouth({ cy, mouthOpen, speaking, closed }) {
  const ry = 1 + mouthOpen * 6;
  return (
    <g>
      <ellipse cx="50" cy={cy} rx={3 + mouthOpen * 2} ry={ry} fill={speaking ? "#7a2a2a" : closed} />
      {speaking && mouthOpen > 0.25 && <ellipse cx="50" cy={cy - 1} rx={2 + mouthOpen} ry={Math.min(ry - 1, 2.5)} fill="rgba(255,255,255,0.6)" />}
    </g>
  );
}

/* Socrates: bald, white side hair, big white beard, toga */
function SocratesFace({ mouthOpen, speaking, blink, look, brow }) {
  return (
    <g>
      <path d="M20 95 Q25 72 35 68 Q50 62 65 68 Q75 72 80 95" fill="#9ab8c4" />
      <path d="M25 95 Q28 76 38 72 Q50 66 62 72 Q72 76 75 95" fill="#b5d1db" />
      <path d="M42 72 Q48 78 55 72" stroke="#8aa8b4" strokeWidth="0.8" fill="none" />
      <rect x="42" y="58" width="16" height="14" rx="6" fill="#e8b888" />
      <ellipse cx="50" cy="42" rx="22" ry="24" fill="#e8b888" />
      <ellipse cx="50" cy="32" rx="20" ry="14" fill="#e8b888" />
      <path d="M28 35 Q26 45 28 55 Q30 52 32 42 Q30 38 28 35" fill="#d0d0d0" />
      <path d="M30 36 Q28 44 30 52 Q32 48 33 40 Q32 37 30 36" fill="#e0e0e0" />
      <path d="M72 35 Q74 45 72 55 Q70 52 68 42 Q70 38 72 35" fill="#d0d0d0" />
      <path d="M70 36 Q72 44 70 52 Q68 48 67 40 Q68 37 70 36" fill="#e0e0e0" />
      <Brows brow={brow} color="#d0d0d0" width="2.5" />
      <Eyes blink={blink} look={look} iris="#5a4a30" speaking={speaking} />
      <ellipse cx="50" cy="48" rx="3" ry="2.5" fill="#d4a070" />
      <path d="M32 52 Q34 48 40 50 Q50 46 60 50 Q66 48 68 52 Q70 60 68 70 Q64 78 50 80 Q36 78 32 70 Q30 60 32 52" fill="#e8e8e8" />
      <path d="M34 54 Q36 50 42 52 Q50 48 58 52 Q64 50 66 54 Q68 62 66 68 Q62 74 50 76 Q38 74 34 68 Q32 62 34 54" fill="#f0f0f0" />
      <path d="M42 58 Q44 65 42 72" stroke="#d8d8d8" strokeWidth="0.5" fill="none" />
      <path d="M50 56 Q50 65 50 74" stroke="#d8d8d8" strokeWidth="0.5" fill="none" />
      <path d="M58 58 Q56 65 58 72" stroke="#d8d8d8" strokeWidth="0.5" fill="none" />
      <path d="M40 52 Q45 50 50 52 Q55 50 60 52 Q58 54 50 54 Q42 54 40 52" fill="#e0e0e0" />
      <Mouth cy={55} mouthOpen={mouthOpen} speaking={speaking} closed="#d8a070" />
      <ellipse cx="28" cy="42" rx="3" ry="5" fill="#e0a878" />
      <ellipse cx="72" cy="42" rx="3" ry="5" fill="#e0a878" />
    </g>
  );
}

/* Aristotle: brown curly hair, trimmed beard, toga */
function AristotleFace({ mouthOpen, speaking, blink, look, brow }) {
  return (
    <g>
      <path d="M20 95 Q25 72 35 68 Q50 62 65 68 Q75 72 80 95" fill="#4a6a8a" />
      <path d="M25 95 Q28 76 38 72 Q50 66 62 72 Q72 76 75 95" fill="#e8dcc8" />
      <path d="M38 72 Q35 80 32 95 L55 95 Q52 82 48 74" fill="#5a7a9a" opacity="0.7" />
      <path d="M40 74 Q38 82 36 95 L50 95 Q48 84 46 76" fill="#6a8aaa" opacity="0.5" />
      <rect x="42" y="58" width="16" height="14" rx="6" fill="#d4a070" />
      <ellipse cx="50" cy="42" rx="22" ry="24" fill="#d4a070" />
      <path d="M28 38 Q26 28 32 22 Q38 16 50 15 Q62 16 68 22 Q74 28 72 38 Q70 32 64 26 Q56 20 50 19 Q44 20 36 26 Q30 32 28 38" fill="#5a3a1a" />
      <circle cx="32" cy="26" r="4" fill="#6a4a2a" />
      <circle cx="40" cy="20" r="4.5" fill="#6a4a2a" />
      <circle cx="50" cy="18" r="4.5" fill="#5a3a1a" />
      <circle cx="60" cy="20" r="4.5" fill="#6a4a2a" />
      <circle cx="68" cy="26" r="4" fill="#6a4a2a" />
      <circle cx="28" cy="34" r="3.5" fill="#5a3a1a" />
      <circle cx="72" cy="34" r="3.5" fill="#5a3a1a" />
      <Brows brow={brow} color="#4a3020" width="2" />
      <Eyes blink={blink} look={look} iris="#3a5a7a" speaking={speaking} />
      <path d="M50 43 L48 49 Q50 50 52 49 Z" fill="#c49060" />
      <path d="M34 52 Q36 50 42 51 Q50 48 58 51 Q64 50 66 52 Q68 58 66 64 Q62 70 50 72 Q38 70 34 64 Q32 58 34 52" fill="#5a3a1a" />
      <path d="M36 54 Q38 52 44 53 Q50 50 56 53 Q62 52 64 54 Q66 58 64 62 Q60 66 50 68 Q40 66 36 62 Q34 58 36 54" fill="#6a4a2a" />
      <path d="M40 52 Q45 50 50 52 Q55 50 60 52 Q58 54 50 54 Q42 54 40 52" fill="#5a3a1a" />
      <Mouth cy={56} mouthOpen={mouthOpen} speaking={speaking} closed="#c49060" />
      <ellipse cx="28" cy="42" rx="3" ry="5" fill="#c89868" />
      <ellipse cx="72" cy="42" rx="3" ry="5" fill="#c89868" />
    </g>
  );
}
