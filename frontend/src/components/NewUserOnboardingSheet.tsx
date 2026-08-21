"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface NewUserOnboardingSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Shown exactly once, right after a real account's first sign-in (see
// AuthContext.tsx's isNewUser). Sets expectations honestly rather than
// letting a new user wonder why "Why this pace?" (WhyPredictionSheet) keeps
// saying "early estimate" for their first couple weeks — same
// cold-start/trained-embedding split from Step 4/8, just explained upfront
// instead of only showing up as a badge later.
export const NewUserOnboardingSheet: React.FC<NewUserOnboardingSheetProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[85]">
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
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/15 border border-primary-500/30 mb-4">
              <Sparkles className="w-6 h-6 text-primary-300" />
            </div>

            <h5 className="text-lg font-medium text-white m-0">Welcome to Live mode</h5>
            <p className="text-[13.5px] leading-relaxed text-gray-300 mt-2.5 m-0">
              For the next <span className="text-white font-semibold">2 weeks</span>, Antara is getting to know you —
              every rupee you log teaches it your actual habits, not a generic teen's. Until then, predictions in the
              "Why this pace?" screen are an honest early estimate off spending-survey benchmarks, clearly labeled as
              such.
            </p>
            <p className="text-[13.5px] leading-relaxed text-gray-300 mt-2.5 m-0">
              After 2 weeks of real logs, predictions switch to personalized — trained on your data specifically. The
              more consistently you log now, the better it gets then.
            </p>

            <button
              onClick={onClose}
              className="w-full h-11 mt-5 rounded-2xl bg-primary-600 text-white text-sm font-bold shadow-glow-primary"
            >
              Got it, let's start
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
