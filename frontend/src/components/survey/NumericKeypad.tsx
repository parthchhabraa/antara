"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete } from "lucide-react";

interface NumericKeypadProps {
  /** Raw digit string, e.g. "1500". Empty string means nothing entered yet. */
  value: string;
  onChange: (value: string) => void;
  maxDigits?: number;
  quickAdd?: number[];
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

// Full on-screen digit pad (not a native <input type="number">) so the OS
// keyboard never pops up mid-flow — keeps the single-question, full-screen
// focus intact on mobile, the way Antara's quick-log amount entry is meant to feel.
export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  maxDigits = 6,
  quickAdd = [100, 500, 1000, 2000],
}) => {
  const press = (key: string) => {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "clear") {
      onChange("");
      return;
    }
    if (value === "0") {
      onChange(key);
      return;
    }
    if (value.length >= maxDigits) return;
    onChange(value + key);
  };

  const addQuick = (amount: number) => {
    const current = parseInt(value || "0", 10);
    const next = Math.min(current + amount, Math.pow(10, maxDigits) - 1);
    onChange(String(next));
  };

  const display = value === "" ? "0" : new Intl.NumberFormat("en-IN").format(parseInt(value, 10));

  return (
    <div className="space-y-4">
      {/* Amount display */}
      <div className="flex items-baseline justify-center gap-1.5 py-1 overflow-hidden">
        <span className={`text-xl font-bold ${value ? "text-purple-400" : "text-gray-700"}`}>₹</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={display}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={`text-4xl font-black tracking-tight tabular-nums ${
              value ? "text-white" : "text-gray-700"
            }`}
          >
            {display}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* N/A + quick-add chips, mirrors QuickLogModal's denomination chips */}
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => onChange("0")}
          className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors ${
            value === "0"
              ? "bg-purple-500/20 border-purple-500/60 text-purple-300"
              : "bg-white/5 border-white/10 text-gray-400 hover:text-gray-200"
          }`}
        >
          ₹0 / N/A
        </motion.button>
        {quickAdd.map((amt) => (
          <motion.button
            key={amt}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => addQuick(amt)}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-purple-500/15 border border-white/10 hover:border-purple-500/40 text-xs font-semibold text-gray-300 hover:text-purple-300 transition-colors"
          >
            +{amt >= 1000 ? `${amt / 1000}k` : amt}
          </motion.button>
        ))}
      </div>

      {/* Digit pad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.1 }}
            onClick={() => press(key)}
            className={`h-12 rounded-2xl flex items-center justify-center transition-colors ${
              key === "clear"
                ? "bg-white/5 border border-white/10 text-gray-500 text-[11px] font-bold uppercase tracking-wide"
                : key === "back"
                ? "bg-white/5 border border-white/10 text-gray-300"
                : "bg-white/[0.04] border border-white/10 text-white text-lg font-bold hover:bg-purple-500/10 hover:border-purple-500/30"
            }`}
          >
            {key === "back" ? <Delete className="w-4 h-4" /> : key === "clear" ? "Clear" : key}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
