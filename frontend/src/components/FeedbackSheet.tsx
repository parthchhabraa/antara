"use client";

import React, { useEffect, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { MessageSquareText } from "lucide-react";
import { submitFeedback } from "@/lib/api";

interface FeedbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser;
  onSent: () => void;
}

// Brief 5 (2026-09-05): in-app feedback, reachable from the profile
// screen. Writes directly to Firestore (see lib/api.ts's submitFeedback —
// owner-create-only, superadmin-read, see firestore.rules) rather than a
// backend endpoint; there's no server-side logic to run, just a record.
export const FeedbackSheet: React.FC<FeedbackSheetProps> = ({ isOpen, onClose, user, onSent }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMessage("");
      setSending(false);
      setError(null);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitFeedback(user, trimmed);
      onSent();
      onClose();
    } catch (e) {
      setError("Couldn't send that — check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[95]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/76 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 rounded-t-lg bg-[#1b1e2e] border-t border-white/10 shadow-2xl px-5 pt-3.5 pb-8"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-3.5" />

            <div className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-primary-400" />
              <h5 className="text-sm font-semibold text-white m-0">Send feedback</h5>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Bug, confusing screen, or an idea — this goes straight to the person who built Antara, not a support
              queue.
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              placeholder="What's on your mind?"
              rows={5}
              autoFocus
              className="w-full mt-3.5 px-3.5 py-3 rounded-sm bg-white/5 border border-white/10 text-xs text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60 resize-none"
            />
            <div className="text-right text-xs text-gray-600 mt-1">{message.length}/2000</div>

            {error && (
              <div className="mt-2 p-3 rounded-sm bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="w-full h-12 mt-4 rounded-lg bg-primary-600 text-white font-bold text-sm disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-transform"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
