"use client";

import React from "react";
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
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
              isSelected
                ? "bg-emerald-500/15 border-emerald-500/60 shadow-glow-emerald"
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
                isSelected ? "bg-emerald-500 border-emerald-500" : "border-white/20"
              }`}
            >
              {isSelected && <Check className="w-3 h-3 text-[#05100B]" strokeWidth={3} />}
            </div>
          </button>
        );
      })}
    </div>
  );
};
