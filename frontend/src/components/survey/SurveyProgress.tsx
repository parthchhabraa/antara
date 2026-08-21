"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface SurveyProgressProps {
  step: number; // 1-indexed, includes intro
  totalSteps: number;
  onBack?: () => void;
}

export const SurveyProgress: React.FC<SurveyProgressProps> = ({ step, totalSteps, onBack }) => {
  const pct = Math.min(100, Math.round((step / totalSteps) * 100));

  return (
    <div className="shrink-0 bg-[#05100B]/90 backdrop-blur-xl px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          whileTap={onBack ? { scale: 0.88 } : undefined}
          onClick={onBack}
          disabled={!onBack}
          aria-label="Back"
          className="w-8 h-8 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-0 disabled:pointer-events-none"
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-gold-400"
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
        <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-9 text-right">
          {step}/{totalSteps}
        </span>
      </div>
    </div>
  );
};
