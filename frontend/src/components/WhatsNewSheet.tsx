"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { Sparkles } from "lucide-react";
import { ChangelogEntry } from "@/lib/changelog";

interface WhatsNewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ChangelogEntry;
}

// Same bottom-sheet shape as CategoryDetailSheet/TransactionEditSheet
// (bg-[#1b1e2e], rounded-t-lg, spring slide-up) — a new pattern wasn't
// invented for this. Shown by WhatsNewGate exactly once per real version
// bump, never on a brand-new device's very first open (see that file).
export const WhatsNewSheet: React.FC<WhatsNewSheetProps> = ({ isOpen, onClose, entry }) => {
  const handleAction = (href: string) => {
    onClose();
    // A real navigation (not next/navigation's router.push) — an action
    // like "Open Wallets" often targets the *same* route ("/?open=wallets")
    // the sheet is already showing on top of, and Next's client-side router
    // reuses the existing page instance for a same-route navigation rather
    // than remounting it, so a mount-only effect there (see page.tsx) would
    // never re-fire. A real navigation always does a fresh mount.
    window.location.href = href;
  };

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
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium tracking-[0.14em] text-primary-300">WHAT'S NEW</div>
                <div className="text-lg font-medium text-white truncate">
                  Antara {entry.version}
                </div>
              </div>
              <span className="text-xs text-gray-500 shrink-0">{entry.date}</span>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {entry.highlights.map((h, i) => (
                <div key={i} className="flex gap-2.5 items-start p-3 rounded-lg bg-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed text-gray-200 m-0">{h.text}</p>
                    {h.image && (
                      // Real rendered screenshot of the actual feature — a
                      // broken path here is worse than no image, so this is
                      // checked directly (not assumed) before shipping;
                      // see REVIEW.md.
                      <img
                        src={h.image}
                        alt=""
                        className="w-full mt-2.5 rounded-sm border border-white/10 block"
                      />
                    )}
                    {h.action && (
                      <button
                        type="button"
                        onClick={() => handleAction(h.action!.href)}
                        className="mt-2.5 h-9 px-3.5 rounded-full bg-primary-600 text-white text-xs font-bold active:scale-[0.97] transition-transform"
                      >
                        {h.action.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full h-12 mt-5 rounded-lg bg-primary-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
