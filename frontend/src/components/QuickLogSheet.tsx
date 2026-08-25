"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete } from "lucide-react";
import { STARTER_CATEGORIES } from "@/lib/constants";
import { Transaction } from "@/types";
import { CategoryIcon } from "./CategoryIcon";

interface QuickLogSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (tx: Omit<Transaction, "id">) => void;
  safeDaily?: number;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

const LAST_CATEGORY_STORAGE_KEY = "antara_quicklog_last_category";

// Full-screen numeric keypad quick-log sheet — tap digits (no free typing),
// pick a category chip, commit. Replaces the old amount-field + chips modal.
//
// Phase 2: defaults the category picker to whatever was logged last, not
// always the first category in the list — most real usage logs a few
// things in the same category back to back (a few snacks in a row, a run
// of transit taps), so remembering it saves a tap on the common case
// instead of always making you re-pick "Food" from scratch.
export const QuickLogSheet: React.FC<QuickLogSheetProps> = ({ isOpen, onClose, onCommit, safeDaily }) => {
  const [amount, setAmount] = useState("");
  const [pick, setPick] = useState(() => {
    try {
      const last = localStorage.getItem(LAST_CATEGORY_STORAGE_KEY);
      if (last && STARTER_CATEGORIES.some((c) => c.id === last)) return last;
    } catch (e) {
      // localStorage unavailable (private mode etc.) — just use the default below.
    }
    return STARTER_CATEGORIES[0].id;
  });

  const category = STARTER_CATEGORIES.find((c) => c.id === pick) || STARTER_CATEGORIES[0];
  const amountNum = amount ? parseInt(amount, 10) : 0;

  const press = (k: string) => {
    if (k === "del") {
      setAmount((a) => a.slice(0, -1));
    } else if (k === "00") {
      setAmount((a) => (a.length && a.length < 5 ? a + "00" : a));
    } else {
      setAmount((a) => (a.length < 5 && !(k === "0" && !a) ? a + k : a));
    }
  };

  const commit = () => {
    if (!amountNum) return;
    onCommit({
      amount: amountNum,
      category: pick,
      subcategory: category.subcategories[0] || "",
      timestamp: new Date().toISOString(),
      source: "upi",
    });
    try {
      localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, pick);
    } catch (e) {
      // Non-fatal — just means next time won't default to this category.
    }
    setAmount("");
  };

  const todayLabel = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80]">
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
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl px-5 pt-3.5 pb-8"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-3.5" />

            <div className="flex items-baseline gap-2.5">
              <h5 className="text-sm font-semibold text-white m-0">What did you spend?</h5>
              <span className="ml-auto text-[11px] text-gray-500" suppressHydrationWarning>
                {todayLabel}
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
            <div className="text-center text-[11.5px] text-gray-500 mb-3">
              {amount && safeDaily
                ? `That is ${(amountNum / safeDaily).toFixed(1)}× a safe day`
                : "Tap the amount, pick where it went"}
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

            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <motion.button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  whileTap={{ scale: 0.93 }}
                  className="h-[50px] rounded-2xl bg-white/5 text-white text-xl font-medium flex items-center justify-center"
                  style={{ transition: "background-color .15s ease" }}
                >
                  {k === "del" ? <Delete className="w-5 h-5" /> : k}
                </motion.button>
              ))}
            </div>

            <motion.button
              type="button"
              onClick={commit}
              disabled={!amountNum}
              whileTap={{ scale: 0.98 }}
              className="w-full h-12 mt-3.5 rounded-2xl bg-transparent border border-primary-500/60 text-primary-300 font-bold text-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              {amountNum ? `Log ₹${amountNum.toLocaleString("en-IN")} · ${category.short}` : "Enter an amount"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
