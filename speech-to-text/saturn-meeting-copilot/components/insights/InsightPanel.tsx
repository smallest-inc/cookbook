"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
import { Insight } from "@/types";
import {
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { ExaBotStatus } from "@/components/insights/ExaBotStatus";

export function InsightPanel() {
  const { insights, activeInsightId, setActiveInsight } = useMeetingStore();

  return (
    <div className="flex flex-col h-full bg-white/30 backdrop-blur-2xl">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/40 bg-white/20">
        <Sparkles className="w-4 h-4 text-violet-600" />
        <span className="text-sm font-semibold text-slate-800">AI Insights</span>
        <div className="flex-1" />
        <ExaBotStatus />
        {insights.length > 0 && (
          <span className="text-xs bg-violet-100 border border-violet-200 text-violet-700 font-medium rounded-full px-2 py-0.5 ml-1 shadow-sm shadow-violet-200/50">
            {insights.length}
          </span>
        )}
      </div>

      {/* Insights list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {insights.length === 0 ? (
          <InsightEmptyState />
        ) : (
          <AnimatePresence initial={false}>
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                isExpanded={activeInsightId === insight.id}
                onToggle={() =>
                  setActiveInsight(activeInsightId === insight.id ? null : insight.id)
                }
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function InsightEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-20">
      <div className="relative">
        <div className="w-14 h-14 rounded-full bg-white/70 backdrop-blur-xl border border-white flex items-center justify-center shadow-lg shadow-violet-200/50 z-10 relative">
          <Sparkles className="w-6 h-6 text-violet-400" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-violet-400/20 blur-md pointer-events-none"
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm text-slate-500 font-semibold tracking-wide">No insights yet</p>
        <p className="text-[13px] text-slate-400 px-6 leading-relaxed">
          Ask questions in the meeting and Saturn will automatically research them.
        </p>
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  isExpanded,
  onToggle,
}: {
  insight: Insight;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const confidencePct = Math.round(insight.confidence * 100);
  const confidenceColor =
    insight.confidence > 0.85
      ? "text-emerald-400"
      : insight.confidence > 0.7
      ? "text-amber-400"
      : "text-red-400";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-lg ${
        insight.status === "researching"
          ? "border-violet-200/60 bg-white/60 shadow-violet-200/20"
          : isExpanded
          ? "border-violet-300 bg-white/90 shadow-violet-200/40"
          : "border-white/60 bg-white/40 hover:bg-white/70 shadow-slate-200/20"
      } backdrop-blur-xl`}
    >
      {/* Research glow effect */}
      {insight.status === "researching" && (
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-0.5 bg-gradient-to-r from-violet-600 via-indigo-400 to-violet-600"
        />
      )}

      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
        disabled={insight.status === "researching"}
      >
        {/* Status icon */}
        <div className="mt-0.5 flex-shrink-0 bg-white/50 p-1.5 rounded-full shadow-sm border border-white/60">
          {insight.status === "researching" ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-4 h-4 text-violet-600" />
            </motion.div>
          ) : insight.status === "ready" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {/* Topic */}
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-slate-800 truncate tracking-tight">
              {insight.topic}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-slate-900/30 font-mono">{insight.timestamp}</span>
            {insight.status === "ready" && (
              <>
                <span className="text-slate-900/20">·</span>
                <span className={`text-[10px] font-medium ${confidenceColor}`}>
                  {confidencePct}% confidence
                </span>
                <span className="text-slate-900/20">·</span>
                <span className="text-[10px] text-slate-900/30">
                  {insight.sources.length} sources
                </span>
              </>
            )}
            {insight.status === "researching" && (
              <span className="text-[10px] text-violet-400">Searching the web...</span>
            )}
          </div>
        </div>

        {insight.status === "ready" && (
          <div className="text-slate-900/30 flex-shrink-0 mt-0.5">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && insight.status === "ready" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Divider */}
              <div className="h-px bg-slate-200/60" />

              {/* Confidence bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Confidence</span>
                  <span className={`text-[10px] font-semibold ${confidenceColor}`}>
                    {confidencePct}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden shadow-inner shadow-slate-300 flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${confidencePct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                    className={`h-full rounded-full ${
                      insight.confidence > 0.85
                        ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                        : insight.confidence > 0.7
                        ? "bg-gradient-to-r from-amber-400 to-orange-400"
                        : "bg-gradient-to-r from-red-400 to-rose-400"
                    }`}
                  />
                </div>
              </div>

              {/* Hero answer */}
              {insight.bullets[0] && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-[22px] font-bold text-slate-900 leading-tight"
                >
                  {insight.bullets[0]}
                </motion.p>
              )}

              {/* Detail bullets */}
              {insight.bullets.length > 1 && (
                <div className="space-y-2.5">
                  {insight.bullets.slice(1).map((bullet, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06, duration: 0.25 }}
                      className="flex gap-3"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0 shadow-sm shadow-violet-300" />
                      <p className="text-[13px] text-slate-600 leading-relaxed">{bullet}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Sources */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Sources</span>
                {insight.sources.map((source, i) => (
                  <motion.a
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-sm shadow-slate-200/30 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all group"
                  >
                    <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                      <span className="text-[9px] text-slate-500 font-bold">{i + 1}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-600 group-hover:text-violet-600 truncate flex-1 transition-colors">
                      {source.title}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 flex-shrink-0 transition-colors" />
                  </motion.a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
