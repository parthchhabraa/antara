"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { Check } from "lucide-react";

export interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
}

interface ChoiceListProps {
  options: ChoiceOption[];
  selected: string | null;
  onSelect: (value: string) => void;
}

export const ChoiceList: React.FC<ChoiceListProps> = ({ options, selected, onSelect }) => {
  return (
    <div className="space-y-2.5">
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(opt.value)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border text-left transition-colors ${
              isSelected
                ? "bg-purple-500/15 border-purple-500/60"
                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
            }`}
          >
            <div>
              <p className={`text-sm font-semibold ${isSelected ? "text-white" : "text-gray-200"}`}>
                {opt.label}
              </p>
              {opt.hint && <p className="text-[11px] text-gray-500 mt-0.5">{opt.hint}</p>}
            </div>
            <div
              className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center ${
                isSelected ? "bg-purple-500 border-purple-500" : "border-white/20"
              }`}
            >
              <AnimatePresence>
                {isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={springs.default}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
