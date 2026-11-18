"use client";

/**
 * ExaBotStatus — shows whether the Exa research bot is listening or actively searching.
 * Displayed in the InsightPanel header while a meeting is running.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
import { Loader2 } from "lucide-react";

export function ExaBotStatus() {
  const status = useMeetingStore((s) => s.status);
  const activeResearchCount = useMeetingStore((s) => s.activeResearchCount);

  const isInMeeting = status === "listening" || status === "paused";
  const isSearching = activeResearchCount > 0;

  return (
    <AnimatePresence>
      {isInMeeting && (
        <motion.div
          key="exa-bot-status"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors duration-300 ${
            isSearching
              ? "bg-violet-500/10 border-violet-500/25 text-violet-300"
              : "bg-emerald-500/8 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {isSearching ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-3 h-3" />
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            />
          )}

          <span>
            {isSearching
              ? activeResearchCount > 1
                ? `Searching (${activeResearchCount})`
                : "Searching…"
              : "Exa listening"}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
