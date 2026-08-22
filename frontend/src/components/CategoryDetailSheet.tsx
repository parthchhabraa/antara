"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Category, Transaction } from "@/types";
import { FORMAT_INR } from "@/lib/constants";
import { CategoryIcon } from "./CategoryIcon";

interface CategoryDetailSheetProps {
  category: Category | null;
  entries: Transaction[]; // already filtered to this category, newest first
  onClose: () => void;
  // Step 13 — tapping an entry opens TransactionEditSheet (rendered by the
  // parent page, above this sheet) for edit/delete. Optional so any future
  // read-only caller of this component doesn't have to wire it up.
  onSelectEntry?: (tx: Transaction) => void;
}

export const CategoryDetailSheet: React.FC<CategoryDetailSheetProps> = ({ category, entries, onClose, onSelectEntry }) => {
  return (
    <AnimatePresence>
      {category && (
        <div className="fixed inset-0 z-[70]">
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
            className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            {(() => {
              const spent = entries.reduce((s, e) => s + e.amount, 0);
              const hasCap = category.monthly_cap !== undefined;
              const overCap = hasCap && spent > (category.monthly_cap as number);
              const capPct = hasCap ? Math.min(100, (spent / (category.monthly_cap as number)) * 100) : 0;
              return (
                <>
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={category} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium tracking-[0.14em] text-primary-300">
                        {category.is_essential ? "NEED" : "WANT"} · {entries.length} {entries.length === 1 ? "ENTRY" : "ENTRIES"}
                      </div>
                      <div className="text-lg font-medium text-white truncate">{category.name}</div>
                    </div>
                    <span className="text-2xl font-medium text-white shrink-0">{FORMAT_INR(spent)}</span>
                  </div>

                  {hasCap ? (
                    <>
                      <div className="mt-4 h-[5px] rounded-full bg-white/10 relative overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${overCap ? "bg-gradient-to-r from-rose-500 to-amber-500" : "bg-primary-400"}`}
                          style={{ width: `${capPct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 text-xs text-gray-500">
                        {overCap
                          ? `${FORMAT_INR(spent - (category.monthly_cap as number))} past the ${FORMAT_INR(category.monthly_cap as number)} you set`
                          : `${FORMAT_INR((category.monthly_cap as number) - spent)} left of ${FORMAT_INR(category.monthly_cap as number)}`}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-xs text-gray-500">No cap set yet — needs real survey data for this category.</div>
                  )}

                  <div className="mt-4 p-3.5 rounded-2xl bg-primary-900/30 text-[13px] leading-relaxed text-gray-200">
                    {!hasCap
                      ? "No baseline yet for this one — Antara will suggest a cap once there's real survey data to set it from."
                      : overCap
                      ? "This one is over. Park it for a week and the run-out date moves back."
                      : "Comfortable. Keep it here and you finish the month with room to spare."}
                  </div>

                  {entries.length > 0 && onSelectEntry && (
                    <div className="mt-3 text-[11px] text-gray-600">tap an entry to edit or delete</div>
                  )}
                  <div className="mt-2 flex flex-col">
                    {entries.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-500">Nothing logged here yet this month.</p>
                    ) : (
                      entries.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onSelectEntry?.(e)}
                          disabled={!onSelectEntry}
                          className="flex gap-3 py-3 border-b border-white/5 last:border-0 text-left w-full active:opacity-60 transition-opacity disabled:active:opacity-100"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-gray-100">{e.subcategory || category.name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {e.note ? ` · ${e.note}` : ""}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-white shrink-0">{FORMAT_INR(e.amount)}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              );
            })()}

            <button
              onClick={onClose}
              className="w-full h-11 mt-4 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
