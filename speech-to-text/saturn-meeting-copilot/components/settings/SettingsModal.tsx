"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const RESULT_COUNTS = [3, 5, 8, 10];

export function SettingsModal({ isOpen, onClose }: Props) {
  const { researchResultCount, setResearchResultCount } = useMeetingStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-2xl shadow-slate-300/30 overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Settings</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-5 space-y-6">
                {/* ── Research section ── */}
                <Section icon={<Search className="w-4 h-4 text-amber-500" />} title="Research">
                  <Row label="Results per query">
                    <div className="flex gap-1.5">
                      {RESULT_COUNTS.map((n) => (
                        <button
                          key={n}
                          onClick={() => setResearchResultCount(n)}
                          className={`w-9 py-1 rounded-lg text-xs font-medium transition-all ${
                            researchResultCount === n
                              ? "bg-amber-100 border border-amber-300 text-amber-700"
                              : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </Row>
                </Section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-2.5 pl-1">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </div>
  );
}
