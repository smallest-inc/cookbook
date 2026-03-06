"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function ApiKeyInput({ onKeysSet, hasServerKeys }) {
  const [show, setShow] = useState(!hasServerKeys);
  const [smallestKey, setSmallestKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (smallestKey.trim() && openaiKey.trim()) {
      onKeysSet({ smallestKey: smallestKey.trim(), openaiKey: openaiKey.trim() });
      setSaved(true);
    }
  };

  if (hasServerKeys && !show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-[10px] text-cream/15 hover:text-cream/30 font-display tracking-wider transition-colors"
      >
        Use your own API keys
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="glass-gold rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-gold/50 font-display">
            API Keys {saved && <span className="text-olive">— saved</span>}
          </span>
          {hasServerKeys && (
            <button
              onClick={() => { setShow(false); onKeysSet(null); }}
              className="text-[10px] text-cream/20 hover:text-cream/40"
            >
              Use server keys
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] text-cream/25 tracking-wider">
              SMALLEST_API_KEY
            </label>
            <input
              type="password"
              value={smallestKey}
              onChange={(e) => { setSmallestKey(e.target.value); setSaved(false); }}
              placeholder="sk-..."
              className="w-full px-3 py-2 glass-gold rounded-lg text-xs text-cream/60 bg-transparent focus:outline-none placeholder-cream/15"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-cream/25 tracking-wider">
              OPENAI_API_KEY
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => { setOpenaiKey(e.target.value); setSaved(false); }}
              placeholder="sk-..."
              className="w-full px-3 py-2 glass-gold rounded-lg text-xs text-cream/60 bg-transparent focus:outline-none placeholder-cream/15"
            />
          </div>
        </div>
        {!saved && smallestKey && openaiKey && (
          <button
            onClick={handleSave}
            className="w-full py-2 rounded-lg text-[10px] font-display tracking-wider uppercase glass-gold-strong text-gold/60 hover:text-gold transition-all"
          >
            Save Keys
          </button>
        )}
        <p className="text-[9px] text-cream/15 leading-relaxed">
          Keys are stored in your browser only — never sent to our servers. Get keys
          at{" "}
          <a href="https://smallest.ai" target="_blank" className="text-gold/30 hover:text-gold/50 underline">
            smallest.ai
          </a>{" "}
          and{" "}
          <a href="https://platform.openai.com" target="_blank" className="text-gold/30 hover:text-gold/50 underline">
            platform.openai.com
          </a>
        </p>
      </div>
    </motion.div>
  );
}
