"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { ChangelogEntry } from "@/lib/changelog";

interface WhatsNewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ChangelogEntry;
}

// Same bottom-sheet shape as CategoryDetailSheet/TransactionEditSheet
// (bg-[#1b1e2e], rounded-t-3xl, spring slide-up) — a new pattern wasn't
// invented for this. Shown by WhatsNewGate exactly once per real version
// bump, never on a brand-new device's very first open (see that file).
export const WhatsNewSheet: React.FC<WhatsNewSheetProps> = ({ isOpen, onClose, entry }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium tracking-[0.14em] text-primary-300">WHAT'S NEW</div>
                <div className="text-lg font-medium text-white truncate">
                  Antara {entry.version}
                </div>
              </div>
              <span className="text-[11px] text-gray-500 shrink-0">{entry.date}</span>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {entry.highlights.map((h, i) => (
                <div key={i} className="flex gap-2.5 items-start p-3 rounded-2xl bg-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                  <p className="text-[13px] leading-relaxed text-gray-200 m-0">{h}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full h-12 mt-5 rounded-2xl bg-primary-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
