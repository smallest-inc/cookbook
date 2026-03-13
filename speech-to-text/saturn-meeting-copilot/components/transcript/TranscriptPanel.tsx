"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { useMeetingStore } from "@/store/meetingStore";
import { TranscriptSegment } from "@/types";
import { MessageSquare, Search } from "lucide-react";

export function TranscriptPanel() {
  const { transcript, status } = useMeetingStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-200">
        <MessageSquare className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-medium text-slate-600">Live Transcript</span>
        <div className="flex-1" />
        <span className="text-xs text-slate-900/30">{transcript.length} segments</span>
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {transcript.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {transcript.map((segment) => (
                <TranscriptSegmentCard key={segment.id} segment={segment} />
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
      {status === "listening" ? (
        <>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-violet-400"
            />
          </motion.div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Listening...</p>
            <p className="text-xs text-slate-900/25 mt-1">Transcript will appear here</p>
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-slate-900/20" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">No transcript yet</p>
            <p className="text-xs text-slate-900/20 mt-1">Start a meeting to begin transcription</p>
          </div>
        </>
      )}
    </div>
  );
}

function TranscriptSegmentCard({ segment }: { segment: TranscriptSegment }) {
  const isSelf = segment.speaker === "You" || segment.speaker === "User";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`group relative flex w-full ${isSelf ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`flex flex-col gap-1 max-w-[85%] ${isSelf ? 'items-end' : 'items-start'}`}>
        {/* Speaker row */}
        <div className={`flex items-center gap-2 px-1 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{
              backgroundColor: `${segment.speakerColor}20`,
              border: `1px solid ${segment.speakerColor}40`,
              color: segment.speakerColor,
            }}
          >
            {segment.speaker[0]}
          </div>
          <span
            className="text-xs font-semibold"
            style={{ color: segment.speakerColor }}
          >
            {segment.speaker}
          </span>
          <span className="text-xs text-slate-900/25 font-mono">{segment.timestamp}</span>

          {segment.isQuestion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-1 ${isSelf ? 'mr-auto' : 'ml-auto'}`}
            >
              <Search className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] text-violet-400 font-medium">Researching</span>
            </motion.div>
          )}
        </div>

        {/* Text Bubble */}
        <div className={`relative px-4 py-2.5 rounded-2xl ${
          segment.isHighlighted 
            ? "bg-violet-100 border border-violet-200"
            : isSelf 
              ? "bg-violet-600 text-white" 
              : "bg-white border border-slate-200 shadow-sm text-slate-800"
        } ${isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'} ${
          segment.isHighlighted && isSelf ? "!bg-violet-600 border-violet-400 shadow-lg shadow-violet-500/20" : ""
        }`}>
          {/* Question highlight glow */}
          {segment.isHighlighted && !isSelf && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 rounded-2xl bg-violet-500/[0.06] border border-violet-500/20 pointer-events-none"
            />
          )}

          <p className={`text-[15px] leading-relaxed ${
            isSelf 
              ? "text-white"
              : segment.isHighlighted ? "text-slate-900" : "text-slate-800"
          }`}>
            {segment.text}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
