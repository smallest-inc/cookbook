"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { BottomBar } from "@/components/controls/BottomBar";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { InsightPanel } from "@/components/insights/InsightPanel";
import { TopicTimeline } from "@/components/timeline/TopicTimeline";
import { MeetingSummaryModal } from "@/components/insights/MeetingSummaryModal";
import { useMeetingStore } from "@/store/meetingStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FileText } from "lucide-react";
import { useExaBot } from "@/hooks/useExaBot";
import { useGoogleMeetTranscript } from "@/hooks/useGoogleMeetTranscript";

export default function Home() {
  const { status, startMeeting, setSummary, actionItems, transcript, title } = useMeetingStore();
  const [showSummary, setShowSummary] = useState(false);
  const summaryFetchedRef = useRef(false);

  useExaBot();
  useGoogleMeetTranscript();

  // Generate summary from real transcript when meeting ends
  useEffect(() => {
    if (status !== "ended" || summaryFetchedRef.current) return;
    summaryFetchedRef.current = true;

    const fullText = transcript.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    const minutes = Math.floor((Date.now() - (useMeetingStore.getState().startTime?.getTime() ?? Date.now())) / 60000);
    const duration = minutes > 0 ? `${minutes} min` : "< 1 min";

    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: fullText, title, duration }),
    })
      .then((r) => r.json())
      .then(({ summary }) => {
        if (summary) setSummary({ ...summary, actionItems });
      })
      .catch(() => {
        // Fallback: set a minimal summary from what we have
        setSummary({
          title,
          duration,
          summary: "Meeting ended.",
          decisions: [],
          actionItems,
          topics: [],
        });
      })
      .finally(() => setShowSummary(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Reset ref when a new meeting starts
  useEffect(() => {
    if (status === "listening") summaryFetchedRef.current = false;
  }, [status]);

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden relative font-sans">
        {/* Ambient background gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400/[0.1] rounded-full blur-3xl" />
          <div className="absolute -top-20 right-20 w-80 h-80 bg-violet-400/[0.1] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-40 w-72 h-72 bg-fuchsia-400/[0.1] rounded-full blur-3xl" />
        </div>

        <TopBar />

        <div className="flex-1 flex overflow-hidden relative">
          {status === "idle" ? (
            <LandingView onStart={startMeeting} />
          ) : (
            <>
              <div className="hidden md:flex flex-1 flex-col min-w-0 border-r border-white/40 bg-white/30 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] backdrop-blur-2xl z-10 relative">
                <TranscriptPanel />
              </div>
              <div className="flex-1 md:flex-none md:w-[420px] flex-shrink-0 flex flex-col bg-slate-50/40 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)] backdrop-blur-3xl z-10 relative">
                <InsightPanel />
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {status !== "idle" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/40 border-t border-slate-200"
            >
              <TopicTimeline />
            </motion.div>
          )}
        </AnimatePresence>

        <BottomBar />

        <AnimatePresence>
          {status === "ended" && !showSummary && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => setShowSummary(true)}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium shadow-xl shadow-slate-900/10 transition-all z-30"
            >
              <FileText className="w-4 h-4" />
              View Meeting Summary
            </motion.button>
          )}
        </AnimatePresence>

        <MeetingSummaryModal isOpen={showSummary} onClose={() => setShowSummary(false)} />
      </div>
    </TooltipProvider>
  );
}

function LandingView({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 relative z-10">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-violet-100 to-indigo-100 border border-white flex items-center justify-center shadow-xl shadow-violet-200/50">
          <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}>
            <svg className="w-10 h-10 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </motion.div>
        </div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute -inset-3">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-violet-400 shadow-lg shadow-violet-300" />
        </motion.div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="text-center space-y-4"
      >
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">Saturn for Meetings</h1>
        <p className="text-lg text-slate-500 max-w-md leading-relaxed mx-auto font-medium">
          Your AI-powered meeting copilot. Transcribes in real time, detects questions,
          and researches the web so you never miss a beat.
        </p>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="flex flex-wrap justify-center gap-2 max-w-lg"
      >
        {["Live transcription", "Question detection", "Web research", "AI insights", "Action items"].map((f) => (
          <span key={f} className="px-4 py-1.5 rounded-full bg-white/60 border border-slate-200/60 shadow-sm text-sm font-medium text-slate-600 backdrop-blur-md">
            {f}
          </span>
        ))}
      </motion.div>

      {/* Start button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="relative flex items-center gap-3 px-10 py-4 rounded-full bg-slate-900 text-white font-semibold text-base shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 transition-shadow overflow-hidden mt-4"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          Start Meeting
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
            className="absolute inset-0 overflow-hidden pointer-events-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
          </motion.div>
        </motion.button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs font-medium text-slate-400 text-center"
      >
        Microphone access required · Works in any meeting
      </motion.p>
    </div>
  );
}
