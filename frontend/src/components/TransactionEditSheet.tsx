"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { Delete, Trash2 } from "lucide-react";
import { STARTER_CATEGORIES } from "@/lib/constants";
import { Transaction } from "@/types";
import { CategoryIcon } from "./CategoryIcon";

interface TransactionEditSheetProps {
  transaction: Transaction | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<Transaction, "id">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

// Step 13 — the delete/edit surface item 2 asked for, reached by tapping an
// entry in CategoryDetailSheet. Same numeric-keypad + category-chip language
// as QuickLogSheet (item 2's brief: "keep it consistent with the app's
// existing gesture language" — nothing in this app uses swipe-to-delete, so
// a tap-into-a-detail-sheet with a real button is the consistent choice, not
// a bolted-on gesture this codebase doesn't use anywhere else).
//
// Delete requires two taps: the first arms a "tap again to confirm" state
// (auto-disarms after 4s or on sheet close) rather than a native
// window.confirm() — same reasoning as ConsentGate's custom UI over a
// browser dialog, and it reads better for a teen-facing app than a stock
// browser popup.
export const TransactionEditSheet: React.FC<TransactionEditSheetProps> = ({ transaction, onClose, onSave, onDelete }) => {
  const [amount, setAmount] = useState("");
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setPick(transaction.category);
      setNote(transaction.note || "");
      setConfirmingDelete(false);
      setSaving(false);
      setDeleting(false);
    }
  }, [transaction]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const t = window.setTimeout(() => setConfirmingDelete(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmingDelete]);

  if (!transaction) {
    return null;
  }

  const category = STARTER_CATEGORIES.find((c) => c.id === pick) || STARTER_CATEGORIES[0];
  const amountNum = amount ? parseInt(amount, 10) : 0;
  const dirty =
    amountNum !== transaction.amount || pick !== transaction.category || note !== (transaction.note || "");

  const press = (k: string) => {
    if (k === "del") {
      setAmount((a) => a.slice(0, -1));
    } else if (k === "00") {
      setAmount((a) => (a.length && a.length < 5 ? a + "00" : a));
    } else {
      setAmount((a) => (a.length < 5 && !(k === "0" && !a) ? a + k : a));
    }
  };

  const handleSave = async () => {
    if (!amountNum || saving || deleting) return;
    setSaving(true);
    try {
      // Firestore's updateDoc() throws on an `undefined` field value (unlike
      // addDoc/setDoc, which the codebase elsewhere relies on stripping it) —
      // found live while testing this exact "clear the note" case. An empty
      // string, not undefined, is how a cleared note gets saved; every reader
      // of `.note` already treats a falsy value (including "") as "no note".
      await onSave(transaction.id, { amount: amountNum, category: pick, note: note.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTap = async () => {
    if (saving || deleting) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(transaction.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {transaction && (
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
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl px-5 pt-3.5 pb-8"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-3.5" />

            <div className="flex items-baseline gap-2.5">
              <h5 className="text-sm font-semibold text-white m-0">Edit entry</h5>
              <span className="ml-auto text-[11px] text-gray-500">
                {new Date(transaction.timestamp).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
              </span>
            </div>

            <div className="flex items-baseline justify-center gap-1 py-3.5">
              <span className="text-3xl font-medium text-gray-600">₹</span>
              <span
                className="text-[54px] leading-none font-medium tracking-tight"
                style={{ color: amount ? "#e9e9ed" : "#59545c" }}
              >
                {amountNum ? amountNum.toLocaleString("en-IN") : "0"}
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3.5 -mx-5 px-5 no-scrollbar">
              {STARTER_CATEGORIES.map((c) => {
                const active = pick === c.id;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => setPick(c.id)}
                    whileTap={{ scale: 0.94 }}
                    className={`flex-none flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap border transition-colors ${
                      active
                        ? "bg-primary-500/20 border-primary-500 text-primary-200"
                        : "bg-white/5 border-white/10 text-gray-400"
                    }`}
                  >
                    <CategoryIcon category={c} size={22} />
                    <span>{c.short}</span>
                  </motion.button>
                );
              })}
            </div>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              placeholder="Add a note (optional)"
              className="w-full h-11 mb-3 px-3.5 rounded-xl bg-white/5 border border-white/10 text-[13px] text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60"
            />

            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <motion.button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  whileTap={{ scale: 0.93 }}
                  className="h-[46px] rounded-2xl bg-white/5 text-white text-lg font-medium flex items-center justify-center"
                >
                  {k === "del" ? <Delete className="w-4 h-4" /> : k}
                </motion.button>
              ))}
            </div>

            <motion.button
              type="button"
              onClick={handleSave}
              disabled={!amountNum || !dirty || saving || deleting}
              whileTap={{ scale: 0.98 }}
              className="w-full h-12 mt-3.5 rounded-2xl bg-transparent border border-primary-500/60 text-primary-300 font-bold text-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              {saving ? "Saving…" : "Save changes"}
            </motion.button>

            <motion.button
              type="button"
              onClick={handleDeleteTap}
              disabled={saving || deleting}
              whileTap={{ scale: 0.98 }}
              className={`w-full h-12 mt-2 rounded-2xl font-bold text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                confirmingDelete
                  ? "bg-rose-600 text-white"
                  : "bg-transparent border border-rose-500/40 text-rose-400"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? "Deleting…" : confirmingDelete ? "Tap again to confirm — can't be undone" : "Delete this entry"}
              </span>
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
