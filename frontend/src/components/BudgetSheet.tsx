"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { Delete, Wallet } from "lucide-react";
import { AntaraMark } from "./AntaraMark";

interface BudgetSheetProps {
  isOpen: boolean;
  mode: "onboarding" | "edit";
  currentAmount?: number;
  onSave: (amount: number) => Promise<void>;
  onClose?: () => void; // required for edit mode (dismissible); onboarding has no way out but saving
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"];

// Step 13 §1 — one component for both the onboarding ask (blocking, no
// dismiss, right after ConsentGate and before the first Today screen — see
// AppBootGate's pendingBudgetSetup) and the later "Edit" affordance on the
// Today screen (dismissible, pre-filled). Same numeric-keypad language as
// QuickLogSheet/TransactionEditSheet rather than a plain <input type=number>,
// so entering a budget feels like the same app as logging an expense.
export const BudgetSheet: React.FC<BudgetSheetProps> = ({ isOpen, mode, currentAmount, onSave, onClose }) => {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(currentAmount ? String(currentAmount) : "");
      setSaving(false);
    }
  }, [isOpen, currentAmount]);

  const amountNum = amount ? parseInt(amount, 10) : 0;

  const press = (k: string) => {
    if (k === "del") {
      setAmount((a) => a.slice(0, -1));
    } else if (k === "000") {
      setAmount((a) => (a.length && a.length < 4 ? a + "000" : a));
    } else {
      setAmount((a) => (a.length < 6 && !(k === "0" && !a) ? a + k : a));
    }
  };

  const handleSave = async () => {
    if (!amountNum || saving) return;
    setSaving(true);
    try {
      await onSave(amountNum);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[190]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={mode === "edit" ? onClose : undefined}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl px-5 pt-5 pb-8"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            {mode === "onboarding" ? (
              <div className="flex flex-col items-center text-center mb-1">
                <div className="mb-3">
                  <AntaraMark size={36} />
                </div>
                <h5 className="text-lg font-medium text-white m-0">What's your monthly amount?</h5>
                <p className="text-[13px] leading-relaxed text-gray-400 mt-2 mb-0 max-w-[280px]">
                  Your pocket money, allowance, or however much you typically have to spend in a month. This sets
                  your "safe pace" — you can change it anytime later.
                </p>
              </div>
            ) : (
              <div className="flex items-baseline gap-2.5 mb-1">
                <Wallet className="w-4 h-4 text-primary-400" />
                <h5 className="text-sm font-semibold text-white m-0">Edit monthly budget</h5>
                {onClose && (
                  <button onClick={onClose} className="ml-auto text-[12px] text-gray-500 hover:text-gray-300">
                    Cancel
                  </button>
                )}
              </div>
            )}

            <div className="flex items-baseline justify-center gap-1 py-4">
              <span className="text-3xl font-medium text-gray-600">₹</span>
              <span
                className="text-[54px] leading-none font-medium tracking-tight"
                style={{ color: amount ? "#e9e9ed" : "#59545c" }}
              >
                {amountNum ? amountNum.toLocaleString("en-IN") : "0"}
              </span>
              <span className="text-sm text-gray-500 self-end pb-2">/mo</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <motion.button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  whileTap={{ scale: 0.93 }}
                  className="h-[50px] rounded-2xl bg-white/5 text-white text-xl font-medium flex items-center justify-center"
                >
                  {k === "del" ? <Delete className="w-5 h-5" /> : k}
                </motion.button>
              ))}
            </div>

            <motion.button
              type="button"
              onClick={handleSave}
              disabled={!amountNum || saving}
              whileTap={{ scale: 0.98 }}
              className="w-full h-12 mt-3.5 rounded-2xl bg-primary-600 text-white font-bold text-sm shadow-glow-primary disabled:opacity-40 disabled:pointer-events-none transition-opacity"
            >
              {saving ? "Saving…" : mode === "onboarding" ? "That's my number" : "Save"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
