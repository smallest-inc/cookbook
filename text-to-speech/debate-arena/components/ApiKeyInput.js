"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function ApiKeyInput({ onKeysSet, hasServerKeys }) {
  const [smallestKey, setSmallestKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (smallestKey.trim() && openaiKey.trim()) {
      onKeysSet({ smallestKey: smallestKey.trim(), openaiKey: openaiKey.trim() });
      setSaved(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="glass-gold-strong rounded-2xl p-5 space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-sm font-display font-semibold text-gold tracking-wider">
            Enter Your API Keys to Begin
          </div>
          <p className="text-[11px] text-cream/30">
            You need two free API keys to run this demo
          </p>
        </div>

        {/* Key inputs */}
        <div className="space-y-3">
          {/* Smallest AI Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-cream/40 tracking-wider font-medium uppercase">
                Smallest AI API Key
              </label>
              <a
                href="https://smallest.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-gold/50 hover:text-gold tracking-wider font-display transition-colors flex items-center gap-1"
              >
                Get free key &rarr;
              </a>
            </div>
            <input
              type="password"
              value={smallestKey}
              onChange={(e) => { setSmallestKey(e.target.value); setSaved(false); }}
              placeholder="paste your Smallest AI key here"
              className="w-full px-4 py-2.5 glass-gold rounded-xl text-sm text-cream/60 bg-transparent focus:outline-none focus:border-gold/30 placeholder-cream/15 border border-gold/10"
            />
          </div>

          {/* OpenAI Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-cream/40 tracking-wider font-medium uppercase">
                OpenAI API Key
              </label>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-gold/50 hover:text-gold tracking-wider font-display transition-colors flex items-center gap-1"
              >
                Get free key &rarr;
              </a>
            </div>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => { setOpenaiKey(e.target.value); setSaved(false); }}
              placeholder="paste your OpenAI key here"
              className="w-full px-4 py-2.5 glass-gold rounded-xl text-sm text-cream/60 bg-transparent focus:outline-none focus:border-gold/30 placeholder-cream/15 border border-gold/10"
            />
          </div>
        </div>

        {/* Save button */}
        {!saved ? (
          <button
            onClick={handleSave}
            disabled={!smallestKey.trim() || !openaiKey.trim()}
            className="w-full py-3 rounded-xl text-sm font-display font-semibold tracking-[0.15em] uppercase transition-all disabled:opacity-20 disabled:cursor-not-allowed bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 hover:from-gold/30 hover:via-gold/40 hover:to-gold/30 text-gold border border-gold/20 hover:border-gold/40"
          >
            Save Keys
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="w-2 h-2 rounded-full bg-olive" />
            <span className="text-sm font-display text-olive tracking-wider">
              Keys saved — ready to debate
            </span>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-[9px] text-cream/15 text-center leading-relaxed">
          Keys stay in your browser only. Never stored on any server.
        </p>
      </div>
    </motion.div>
  );
}
