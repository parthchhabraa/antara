"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AntaraMark } from "./AntaraMark";
import { useAuth } from "@/lib/AuthContext";

// Step 12 — shown exactly once, between a brand-new real sign-in and their
// profile actually being created (see AuthContext's pendingConsent). Worded
// honestly rather than as compliance theater: this doesn't verify age or
// guardian awareness in any real way, and says so, rather than implying a
// checkbox click is meaningful proof of anything.
export const ConsentGate: React.FC = () => {
  const { confirmConsent, declineConsent } = useAuth();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      await confirmConsent();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[190] flex items-center justify-center bg-[#060709] p-6"
      >
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <AntaraMark size={44} />
          </div>
          <h2 className="text-xl font-medium text-white text-center mb-2">Before you start</h2>
          <p className="text-xs text-gray-400 text-center leading-relaxed mb-6">
            One quick thing, since Antara is built for teens and handles real spending data.
          </p>

          <label className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.05] border border-white/10 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary-500 shrink-0"
            />
            <span className="text-xs leading-relaxed text-gray-200">
              I'm using Antara with my parent or guardian's awareness. I understand this is a self-tracking tool,
              not financial advice, and I've read the{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-300 underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-300 underline">
                Terms of Use
              </a>
              .
            </span>
          </label>

          <p className="text-xs text-gray-600 leading-relaxed mb-6 px-1">
            Honestly: checking this box doesn't verify your age or actually confirm a parent knows — we're not able
            to check that. We're asking you to tell us the truth, because that's the honest minimum we can do here,
            not because this checkbox makes anything legally airtight.
          </p>

          <button
            onClick={handleContinue}
            disabled={!checked || submitting}
            className="w-full h-12 rounded-lg bg-primary-600 text-white font-bold text-sm disabled:opacity-40 disabled:pointer-events-none transition-opacity"
          >
            {submitting ? "One sec…" : "Continue"}
          </button>
          <button
            onClick={declineConsent}
            className="w-full h-11 mt-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Not right now
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
