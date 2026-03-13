"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Settings,
  FileText,
  Gauge,
  Loader2,
} from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { useDirectSearch } from "@/hooks/useDirectSearch";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AudioWaveform } from "@/components/controls/AudioWaveform";

export function BottomBar() {
  const {
    status,
    isVoiceEnabled,
    isSpeaking,
    voiceSpeed,
    sttStatus,
    sttError,
    startMeeting,
    pauseMeeting,
    endMeeting,
    setVoiceEnabled,
    setVoiceSpeed,
    setIsSpeaking,
  } = useMeetingStore();

  const { directSearchStatus } = useDirectSearch();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const isActive = status === "listening";
  const isPaused = status === "paused";
  const isEnded = status === "ended";

  const handleMainAction = () => {
    if (status === "idle" || status === "ended") startMeeting();
    else if (isActive) pauseMeeting();
    else if (isPaused) startMeeting();
  };

  return (
    <div className="h-16 border-t border-white/60 bg-white/50 backdrop-blur-2xl flex items-center px-6 gap-4 relative z-20 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.1)]">
      {/* Waveform visualization */}
      <div className="w-32 h-8 flex items-center bg-white/40 rounded-lg p-2 shadow-inner shadow-slate-200 border border-white/60">
        <AudioWaveform active={isActive} />
      </div>

      <div className="w-px h-6 bg-slate-300/50 mx-1" />

      {/* Main controls */}
      <div className="flex items-center gap-2">
        {/* Primary start/pause button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMainAction}
                disabled={isEnded}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? "bg-amber-500/20 border border-amber-500/30 text-amber-700 hover:bg-amber-500/30"
                    : "bg-violet-600 border border-violet-500/50 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isActive ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {status === "idle" ? "Start Meeting" : "Resume"}
                  </>
                )}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-amber-500/10"
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.button>
            }
          />
          <TooltipContent>
            {isActive ? "Pause transcription" : "Start transcription"}
          </TooltipContent>
        </Tooltip>

        {/* Stop button */}
        <AnimatePresence>
          {(isActive || isPaused) && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={endMeeting}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all border border-red-400"
                    >
                      <Square className="w-3.5 h-3.5" />
                      End
                    </motion.button>
                  }
                />
                <TooltipContent>End meeting & generate summary</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* STT status pill — shown in Google Meet mode */}
      <AnimatePresence>
        {sttStatus !== "idle" && (
          <motion.div
            key="stt-status"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border shadow-sm ${
              sttStatus === "error"
                ? "bg-red-50 border-red-200 text-red-600"
                : sttStatus === "transcribing"
                ? "bg-violet-50 border-violet-200 text-violet-600"
                : "bg-emerald-50 border-emerald-200 text-emerald-600"
            }`}
          >
            {sttStatus === "transcribing" ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-3 h-3" />
              </motion.div>
            ) : (
              <motion.div
                animate={sttStatus === "error" ? {} : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`w-1.5 h-1.5 rounded-full ${
                  sttStatus === "error" ? "bg-red-400" : "bg-emerald-400"
                }`}
              />
            )}
            <span className="max-w-[160px] truncate">
              {sttStatus === "error"
                ? (sttError ?? "STT error")
                : sttStatus === "transcribing"
                ? "Transcribing…"
                : "Mic listening"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Direct search indicator */}
      <AnimatePresence>
        {directSearchStatus !== "idle" && (
          <motion.div
            key="direct-search"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
              directSearchStatus === "recording"
                ? "bg-rose-500/10 border-rose-500/25 text-rose-400"
                : "bg-violet-500/10 border-violet-500/25 text-violet-300"
            }`}
          >
            {directSearchStatus === "recording" ? (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-rose-400"
              />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-3 h-3" />
              </motion.div>
            )}
            <span>
              {directSearchStatus === "recording"
                ? "Listening… release Tab"
                : directSearchStatus === "transcribing"
                ? "Transcribing…"
                : "Searching Exa…"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-px h-6 bg-slate-300/50 mx-1" />

      {/* Voice controls */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={() => setVoiceEnabled(!isVoiceEnabled)}
                className={`p-2 rounded-xl transition-all shadow-sm ${
                  isVoiceEnabled
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-emerald-100"
                    : "bg-white/60 border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700"
                }`}
              >
                {isVoiceEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
            }
          />
          <TooltipContent>
            {isVoiceEnabled ? "Disable voice responses" : "Enable voice responses"}
          </TooltipContent>
        </Tooltip>

        {/* Stop speaking */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setIsSpeaking(false)}
              className="px-3 py-1.5 text-xs rounded-xl bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 transition-all font-medium"
            >
              Stop Speaking
            </motion.button>
          )}
        </AnimatePresence>

        {/* Speed control */}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center gap-1.5 p-2 rounded-xl bg-white/60 border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700 transition-all text-xs shadow-sm"
                >
                  <Gauge className="w-4 h-4" />
                  <span className="font-mono font-medium">{voiceSpeed}x</span>
                </button>
              }
            />
            <TooltipContent>Voice speed</TooltipContent>
          </Tooltip>

          <AnimatePresence>
            {showSpeedMenu && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                className="absolute bottom-full mb-2 left-0 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] z-50 min-w-[80px]"
              >
                {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setVoiceSpeed(speed);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                      voiceSpeed === speed
                        ? "bg-violet-100 text-violet-700"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <button className="p-2 rounded-xl bg-white/60 border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700 transition-all shadow-sm">
                <FileText className="w-4 h-4" />
              </button>
            }
          />
          <TooltipContent>Export transcript</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button className="p-2 rounded-xl bg-white/60 border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700 transition-all shadow-sm">
                <Settings className="w-4 h-4" />
              </button>
            }
          />
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
