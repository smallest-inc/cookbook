"use client";

import { useState } from "react";
import { motion } from "framer-motion";

function ScoreBar({ label, score, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-cream/30">{label}</span>
        <span className="text-cream/50 font-semibold tabular-nums">
          {score}/10
        </span>
      </div>
      <div className="h-1.5 bg-cream/[0.03] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

export default function VotePanel({ verdict, onVote }) {
  const [userVote, setUserVote] = useState(null);

  if (!verdict) return null;

  const socratesTot =
    verdict.socrates.wisdom +
    verdict.socrates.rhetoric +
    verdict.socrates.logic;
  const aristotleTot =
    verdict.aristotle.wisdom +
    verdict.aristotle.rhetoric +
    verdict.aristotle.logic;

  const handleVote = (side) => {
    setUserVote(side);
    if (onVote) onVote(side);
  };

  const winnerName =
    verdict.winner === "socrates" ? "Socrates" : "Aristotle";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="space-y-8 meander-top pt-6"
    >
      {/* Verdict */}
      <div className="text-center space-y-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-cream/20 font-display">
          The Verdict of Athens
        </div>
        {/* Laurel + name */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-gold/40 text-2xl">&#x1F33F;</span>
          <span
            className={`font-display text-3xl font-bold ${
              verdict.winner === "socrates" ? "text-gold" : "text-olive"
            }`}
          >
            {winnerName}
          </span>
          <span className="text-gold/40 text-2xl scale-x-[-1] inline-block">
            &#x1F33F;
          </span>
        </div>
        <p className="text-sm text-cream/35 max-w-md mx-auto leading-relaxed font-display italic">
          &ldquo;{verdict.reasoning}&rdquo;
        </p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-gold rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-gold">
              Socrates
            </span>
            <span className="text-xl font-bold text-gold tabular-nums font-body">
              {socratesTot}
              <span className="text-xs text-cream/15 font-normal">/30</span>
            </span>
          </div>
          <ScoreBar label="Wisdom" score={verdict.socrates.wisdom} color="bg-gold" />
          <ScoreBar label="Rhetoric" score={verdict.socrates.rhetoric} color="bg-gold" />
          <ScoreBar label="Logic" score={verdict.socrates.logic} color="bg-gold" />
        </div>

        <div className="glass-gold rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-olive">
              Aristotle
            </span>
            <span className="text-xl font-bold text-olive tabular-nums font-body">
              {aristotleTot}
              <span className="text-xs text-cream/15 font-normal">/30</span>
            </span>
          </div>
          <ScoreBar
            label="Wisdom"
            score={verdict.aristotle.wisdom}
            color="bg-olive"
          />
          <ScoreBar
            label="Rhetoric"
            score={verdict.aristotle.rhetoric}
            color="bg-olive"
          />
          <ScoreBar
            label="Logic"
            score={verdict.aristotle.logic}
            color="bg-olive"
          />
        </div>
      </div>

      {/* User vote */}
      <div className="text-center space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-cream/15 font-display">
          Cast your vote, citizen
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => handleVote("socrates")}
            disabled={userVote !== null}
            className={`px-8 py-3 rounded-xl text-sm font-display font-semibold tracking-wider transition-all ${
              userVote === "socrates"
                ? "bg-gold/30 text-gold border border-gold/40"
                : userVote !== null
                ? "glass-gold text-cream/10 cursor-not-allowed"
                : "glass-gold text-gold/70 border border-gold/15 hover:bg-gold/10 hover:border-gold/30"
            }`}
          >
            Socrates
          </button>
          <button
            onClick={() => handleVote("aristotle")}
            disabled={userVote !== null}
            className={`px-8 py-3 rounded-xl text-sm font-display font-semibold tracking-wider transition-all ${
              userVote === "aristotle"
                ? "bg-olive/30 text-olive border border-olive/40"
                : userVote !== null
                ? "glass-gold text-cream/10 cursor-not-allowed"
                : "glass-gold text-olive/70 border border-olive/15 hover:bg-olive/10 hover:border-olive/30"
            }`}
          >
            Aristotle
          </button>
        </div>
        {userVote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-cream/25 font-display italic"
          >
            {userVote === verdict.winner
              ? "The people of Athens agree with the judge!"
              : "A dissenting voice in the Agora!"}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
