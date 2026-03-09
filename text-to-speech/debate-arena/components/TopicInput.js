"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PhilosopherAvatar from "./PhilosopherAvatar";

const EXAMPLE_TOPICS = [
  "Is artificial intelligence a threat to humanity?",
  "Should knowledge be free for all?",
  "Is democracy the best form of governance?",
  "Does social media corrupt the soul?",
  "Is the pursuit of wealth virtuous?",
  "Should we colonize the stars?",
];

const VOICE_OPTIONS = [
  { id: "hercules", label: "Hercules" },
  { id: "marcus", label: "Marcus" },
  { id: "edward", label: "Edward" },
  { id: "daniel", label: "Daniel" },
  { id: "robert", label: "Robert" },
  { id: "sophia", label: "Sophia" },
  { id: "natalie", label: "Natalie" },
  { id: "persephone", label: "Persephone" },
];

const QUOTES = [
  { text: "The unexamined life is not worth living.", author: "socrates" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "aristotle" },
  { text: "I know that I know nothing.", author: "socrates" },
  { text: "It is the mark of an educated mind to entertain a thought without accepting it.", author: "aristotle" },
  { text: "Strong minds discuss ideas, average minds discuss events, weak minds discuss people.", author: "socrates" },
  { text: "Happiness depends upon ourselves.", author: "aristotle" },
  { text: "Be kind, for everyone you meet is fighting a hard battle.", author: "socrates" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "aristotle" },
  { text: "Wonder is the beginning of wisdom.", author: "socrates" },
  { text: "The more you know, the more you realize you don't know.", author: "aristotle" },
  { text: "Education is the kindling of a flame, not the filling of a vessel.", author: "socrates" },
  { text: "Patience is bitter, but its fruit is sweet.", author: "aristotle" },
];

const ROMAN = { 1: "I", 2: "II", 3: "III" };

const ROAST_TOPICS = [
  "Is a hot dog a sandwich?",
  "Should you put milk before cereal?",
  "Is water wet?",
  "Are birds even real?",
  "Should toilet paper go over or under?",
  "Is math invented or discovered?",
];

export default function TopicInput({ onStart, disabled }) {
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(2);
  const [socratesVoice, setSocratesVoice] = useState("hercules");
  const [aristotleVoice, setAristotleVoice] = useState("edward");
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [breathe, setBreathe] = useState(false);
  const [mode, setMode] = useState("philosophical"); // philosophical | roast

  // Rotate quotes every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % QUOTES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Breathing animation toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathe((b) => !b);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    if (topic.trim()) onStart(topic.trim(), rounds, socratesVoice, aristotleVoice, mode);
  };

  const activeTopics = mode === "roast" ? ROAST_TOPICS : EXAMPLE_TOPICS;

  const quote = QUOTES[quoteIdx];
  const isSocratesQuote = quote.author === "socrates";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      {/* Title */}
      <div className="text-center space-y-3">
        <div className="text-[11px] tracking-[0.4em] text-gold-dim uppercase">
          Welcome to
        </div>
        <h1 className="font-display text-6xl font-bold tracking-wide text-gold">
          The Agora
        </h1>
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent mx-auto" />

        {/* Mode toggle */}
        <div className="flex items-center justify-center gap-1 mt-3">
          <button
            onClick={() => setMode("philosophical")}
            className={`px-4 py-1.5 rounded-l-lg text-[11px] font-display tracking-wider transition-all ${
              mode === "philosophical"
                ? "glass-gold-strong text-gold border border-gold/20"
                : "glass-gold text-cream/25 hover:text-cream/40"
            }`}
          >
            Philosophical
          </button>
          <button
            onClick={() => setMode("roast")}
            className={`px-4 py-1.5 rounded-r-lg text-[11px] font-display tracking-wider transition-all ${
              mode === "roast"
                ? "glass-gold-strong text-terracotta border border-terracotta/20"
                : "glass-gold text-cream/25 hover:text-cream/40"
            }`}
          >
            Roast Battle
          </button>
        </div>
      </div>

      {/* Ambient philosopher avatars with rotating quotes */}
      <div className="flex items-center justify-center gap-6 py-4">
        {/* Socrates */}
        <motion.div
          animate={{ opacity: isSocratesQuote ? 1 : 0.5 }}
          transition={{ duration: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <PhilosopherAvatar name="Socrates" subtitle="" side="socrates" size="small" />
          <span className={`font-display text-xs tracking-wider transition-colors duration-1000 ${isSocratesQuote ? "text-gold/70" : "text-cream/20"}`}>
            Socrates
          </span>
        </motion.div>

        {/* Quote */}
        <div className="flex-1 max-w-xs relative h-24 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div key={quoteIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.6 }} className="text-center px-4">
              <p className="font-display text-sm italic text-cream/35 leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
              <div className={`mt-2 text-[10px] tracking-[0.2em] uppercase font-display ${isSocratesQuote ? "text-gold/30" : "text-olive/35"}`}>
                — {quote.author === "socrates" ? "Socrates" : "Aristotle"}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Aristotle */}
        <motion.div
          animate={{ opacity: !isSocratesQuote ? 1 : 0.5 }}
          transition={{ duration: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <PhilosopherAvatar name="Aristotle" subtitle="" side="aristotle" size="small" />
          <span className={`font-display text-xs tracking-wider transition-colors duration-1000 ${!isSocratesQuote ? "text-olive/70" : "text-cream/20"}`}>
            Aristotle
          </span>
        </motion.div>
      </div>

      {/* Topic input */}
      <div className="space-y-4 max-w-lg mx-auto">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStart()}
          placeholder="Pose a question for debate..."
          disabled={disabled}
          className="w-full px-5 py-4 glass-gold-strong rounded-xl text-cream placeholder-cream/20 focus:outline-none focus:border-gold/30 transition-all text-sm font-body"
        />

        {/* Example topics */}
        <div className="flex flex-wrap gap-2 justify-center">
          {activeTopics.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              disabled={disabled}
              className="text-[11px] px-3 py-1.5 rounded-full glass-gold text-cream/30 hover:text-gold/70 hover:bg-gold/[0.06] transition-all"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Voice selectors */}
      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-gold/50 font-medium">
            Voice of Socrates
          </label>
          <select
            value={socratesVoice}
            onChange={(e) => setSocratesVoice(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2.5 glass-gold rounded-lg text-sm text-cream/60 bg-transparent focus:outline-none appearance-none cursor-pointer"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#1a1510] text-cream">
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-olive/60 font-medium">
            Voice of Aristotle
          </label>
          <select
            value={aristotleVoice}
            onChange={(e) => setAristotleVoice(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2.5 glass-gold rounded-lg text-sm text-cream/60 bg-transparent focus:outline-none appearance-none cursor-pointer"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#1a1510] text-cream">
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Round selector + Start */}
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-center gap-4">
          <span className="text-xs text-cream/25 tracking-[0.15em] uppercase font-display">
            Rounds
          </span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setRounds(n)}
              disabled={disabled}
              className={`w-12 h-12 rounded-lg text-sm font-display font-bold tracking-wider transition-all ${
                rounds === n
                  ? "glass-gold-strong text-gold border border-gold/25"
                  : "glass-gold text-cream/25 hover:text-cream/40"
              }`}
            >
              {ROMAN[n]}
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={disabled || !topic.trim()}
          className="w-full py-4 rounded-xl font-display font-bold text-base tracking-[0.2em] uppercase transition-all disabled:opacity-20 disabled:cursor-not-allowed bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 hover:from-gold/30 hover:via-gold/40 hover:to-gold/30 text-gold border border-gold/20 hover:border-gold/40"
        >
          Begin the Debate
        </button>
      </div>
    </motion.div>
  );
}
