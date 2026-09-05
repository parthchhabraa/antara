"use client";

import React, { useEffect, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteMyAccount } from "@/lib/api";

interface DeleteAccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser;
  // Called only after the backend delete actually succeeds — the caller
  // (profile page) is responsible for signing out and redirecting; this
  // sheet's only job is the confirm + the API call.
  onDeleted: () => void;
}

// Brief 5 (2026-09-05): real account deletion. Two-step confirm, no dark
// patterns — same "tap arms, tap again actually does it" idiom
// TransactionEditSheet already uses for deleting a transaction, not a
// native window.confirm() and not a countdown/typed-confirmation gimmick.
// Opening this sheet at all is already step one of the two steps (the
// profile screen's own "Delete my account" button); the arm-then-confirm
// button inside is step two.
export const DeleteAccountSheet: React.FC<DeleteAccountSheetProps> = ({ isOpen, onClose, user, onDeleted }) => {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirming(false);
      setDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 6000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const handleTap = async () => {
    if (deleting) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount(user);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your account — try again in a moment.");
      setDeleting(false);
      setConfirming(false);
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
            onClick={deleting ? undefined : onClose}
            className="absolute inset-0 bg-black/76 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl px-5 pt-3.5 pb-8"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-3.5" />

            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h5 className="text-sm font-semibold text-white m-0">Delete your account</h5>
            </div>

            <p className="text-[12.5px] leading-relaxed text-gray-400 mt-3">
              This permanently deletes your profile, every transaction, wallet, income entry, and budget instance
              you've logged, your friend connections (removed from your friends' lists too, not just yours), and
              your badges — then your sign-in itself. There's no undo and no grace period.
            </p>
            <p className="text-[12.5px] leading-relaxed text-gray-400 mt-2">
              If you just want a copy of your data first, close this and use "Export my data" instead — it stays
              available until you actually delete.
            </p>

            {error && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[12px] text-rose-200">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="w-full h-12 mt-5 rounded-2xl bg-white/5 text-gray-300 font-semibold text-sm disabled:opacity-40"
            >
              Cancel
            </button>

            <motion.button
              type="button"
              onClick={handleTap}
              disabled={deleting}
              whileTap={{ scale: 0.98 }}
              className={`w-full h-12 mt-2 rounded-2xl font-bold text-sm transition-colors disabled:opacity-60 ${
                confirming ? "bg-rose-600 text-white" : "bg-transparent border border-rose-500/40 text-rose-400"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting
                  ? "Deleting everything…"
                  : confirming
                  ? "Tap again to confirm — this can't be undone"
                  : "Delete my account and all its data"}
              </span>
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
