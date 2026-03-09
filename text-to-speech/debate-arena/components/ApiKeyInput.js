"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ApiKeyInput({ onKeysSet, freeDebatesLeft: freeGenerationsLeft }) {
  const [expanded, setExpanded] = useState(false);
  const [smallestKey, setSmallestKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const mustEnterKeys = freeGenerationsLeft <= 0;

  const handleSave = () => {
    if (smallestKey.trim() && openaiKey.trim()) {
      onKeysSet({ smallestKey: smallestKey.trim(), openaiKey: openaiKey.trim() });
      setSaved(true);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Collapsed state */}
      {!expanded && !saved && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-2"
        >
          {mustEnterKeys ? (
            <>
              <button
                onClick={() => setExpanded(true)}
                className="text-sm font-display text-gold hover:text-gold-bright tracking-wider transition-colors"
              >
                Enter your API keys to continue &darr;
              </button>
              <p className="text-[10px] text-terracotta/60">
                Free generations used up — sign up for keys to keep debating
              </p>
              <p className="text-[10px] text-gold/40 mt-1">
                Join our{" "}
                <a href="https://discord.gg/2VcvUyB2DD" target="_blank" rel="noopener noreferrer" className="text-gold/60 hover:text-gold underline">
                  Discord
                </a>{" "}
                and get $20 in free credits!
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setExpanded(true)}
                className="text-[11px] font-display text-cream/30 hover:text-gold/60 tracking-wider transition-colors"
              >
                Enter your API keys &darr;
              </button>
              <p className="text-[9px] text-cream/15">
                {freeGenerationsLeft} free generation{freeGenerationsLeft !== 1 ? "s" : ""} remaining
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* Saved badge */}
      {saved && !expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-olive" />
          <span className="text-xs font-display text-olive/70 tracking-wider">
            Using your API keys
          </span>
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-cream/20 hover:text-cream/40 ml-2"
          >
            edit
          </button>
        </motion.div>
      )}

      {/* Expanded form */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-gold-strong rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-display font-semibold text-gold tracking-wider">
                  API Keys
                </span>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-cream/20 hover:text-cream/40 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-cream/40 tracking-wider font-medium uppercase">
                      Smallest AI API Key
                    </label>
                    <a
                      href="https://smallest.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gold/50 hover:text-gold tracking-wider font-display transition-colors"
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

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-cream/40 tracking-wider font-medium uppercase">
                      OpenAI API Key
                    </label>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gold/50 hover:text-gold tracking-wider font-display transition-colors"
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

              <button
                onClick={handleSave}
                disabled={!smallestKey.trim() || !openaiKey.trim()}
                className="w-full py-3 rounded-xl text-sm font-display font-semibold tracking-[0.15em] uppercase transition-all disabled:opacity-20 disabled:cursor-not-allowed bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 hover:from-gold/30 hover:via-gold/40 hover:to-gold/30 text-gold border border-gold/20 hover:border-gold/40"
              >
                Save Keys
              </button>

              <div className="text-center space-y-1">
                <p className="text-[9px] text-cream/15 leading-relaxed">
                  Keys stay in your browser only. Never stored on any server.
                </p>
                <p className="text-[10px] text-gold/40">
                  Join our{" "}
                  <a href="https://discord.gg/2VcvUyB2DD" target="_blank" rel="noopener noreferrer" className="text-gold/60 hover:text-gold underline">
                    Discord
                  </a>{" "}
                  and get $20 in free credits!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
