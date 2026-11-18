"use client";

import { motion } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
import { Clock } from "lucide-react";

export function TopicTimeline() {
  const { topics, actionItems } = useMeetingStore();

  if (topics.length === 0 && actionItems.length === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-black/20">
      <div className="px-5 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Topic Timeline
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {topics.map((topic, i) => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: `${topic.color}10`,
                borderColor: `${topic.color}25`,
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: topic.color }}
              />
              <span className="text-xs font-medium" style={{ color: topic.color }}>
                {topic.topic}
              </span>
              <span className="text-[10px] text-slate-900/30 font-mono ml-1">
                {topic.startTime}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Action items strip */}
        {actionItems.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10px] text-slate-900/30 uppercase tracking-wider flex-shrink-0">
              Actions
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0"
                >
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
                  <span className="text-[10px] text-amber-700 max-w-[180px] truncate">
                    {item.text}
                  </span>
                  {item.assignee && (
                    <span className="text-[10px] text-amber-400/60">· {item.assignee}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
