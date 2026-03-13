"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Clock, Zap, CreditCard } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { useEffect, useState } from "react";

export function TopBar() {
  const { status, title, startTime, activeResearchCount, creditBalance, setTitle } =
    useMeetingStore();
  const [elapsed, setElapsed] = useState("00:00");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);

  useEffect(() => {
    if (status !== "listening" || !startTime) return;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime.getTime()) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [status, startTime]);

  const isActive = status === "listening";

  return (
    <div className="h-14 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl flex items-center px-5 gap-4 relative z-20">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold text-white/90 tracking-tight">Saturn</span>
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Meeting title */}
      {isEditingTitle ? (
        <input
          autoFocus
          className="bg-white/5 border border-white/10 rounded-md px-3 py-1 text-sm text-white outline-none focus:border-violet-500/50 w-64"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onBlur={() => {
            setTitle(titleInput || "Untitled Meeting");
            setIsEditingTitle(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setTitle(titleInput || "Untitled Meeting");
              setIsEditingTitle(false);
            }
            if (e.key === "Escape") setIsEditingTitle(false);
          }}
        />
      ) : (
        <button
          onClick={() => setIsEditingTitle(true)}
          className="text-sm font-medium text-white/80 hover:text-white transition-colors"
        >
          {title}
        </button>
      )}

      {/* Recording indicator */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1"
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-red-400"
            />
            <span className="text-xs font-medium text-red-400">LIVE</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer */}
      {status !== "idle" && (
        <div className="flex items-center gap-1.5 text-white/50">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">{elapsed}</span>
        </div>
      )}

      {/* Active research indicator */}
      <AnimatePresence>
        {activeResearchCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full"
            />
            <span className="text-xs text-violet-300">
              Researching{activeResearchCount > 1 ? ` (${activeResearchCount})` : ""}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Credit balance */}
      <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1.5">
        <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-white/70">
          <span className="text-emerald-400 font-semibold">{creditBalance}</span> credits
        </span>
      </div>

      {/* Mic status */}
      <div
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
          isActive
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            : "bg-white/[0.04] border border-white/[0.08] text-white/40"
        }`}
      >
        {isActive ? (
          <Mic className="w-3.5 h-3.5" />
        ) : (
          <MicOff className="w-3.5 h-3.5" />
        )}
        <span>{isActive ? "Listening" : "Idle"}</span>
      </div>
    </div>
  );
}
