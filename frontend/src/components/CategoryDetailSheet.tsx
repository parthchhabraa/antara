"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
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
  // Bug fix: caps used to be nothing but category.monthly_cap — a fixed
  // survey baseline, identical for every user and never settable. `userCap`
  // is the real one this specific user has saved for this category (if
  // any); onSaveCap/onClearCap let them set/change/remove it here, for
  // whichever category they've opened — not just one hardcoded category.
  // Optional so a hypothetical read-only caller isn't forced to wire it up.
  userCap?: number;
  onSaveCap?: (amount: number) => Promise<void>;
  onClearCap?: () => Promise<void>;
}

export const CategoryDetailSheet: React.FC<CategoryDetailSheetProps> = ({
  category,
  entries,
  onClose,
  onSelectEntry,
  userCap,
  onSaveCap,
  onClearCap,
}) => {
  const [isEditingCap, setIsEditingCap] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [savingCap, setSavingCap] = useState(false);

  // Close the little cap editor whenever a different category sheet opens
  // (or this one closes) — otherwise it'd carry stale input into the next
  // category tapped.
  useEffect(() => {
    setIsEditingCap(false);
    setCapInput("");
  }, [category?.id]);

  const handleSaveCap = async () => {
    const amount = Number(capInput);
    if (!onSaveCap || !amount || amount <= 0) return;
    setSavingCap(true);
    try {
      await onSaveCap(amount);
      setIsEditingCap(false);
    } finally {
      setSavingCap(false);
    }
  };

  const handleClearCap = async () => {
    if (!onClearCap) return;
    setSavingCap(true);
    try {
      await onClearCap();
      setIsEditingCap(false);
    } finally {
      setSavingCap(false);
    }
  };

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
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            {(() => {
              const spent = entries.reduce((s, e) => s + e.amount, 0);
              const hasUserCap = userCap !== undefined;
              // Real per-user cap wins when set; otherwise fall back to the
              // survey-derived suggested baseline (still useful context,
              // just not something this user actually chose).
              const effectiveCap = userCap ?? category.monthly_cap;
              const hasCap = effectiveCap !== undefined;
              const overCap = hasCap && spent > (effectiveCap as number);
              const capPct = hasCap ? Math.min(100, (spent / (effectiveCap as number)) * 100) : 0;
              return (
                <>
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={category} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium tracking-[0.14em] text-primary-300">
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
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">
                          {overCap
                            ? `${FORMAT_INR(spent - (effectiveCap as number))} past the ${FORMAT_INR(effectiveCap as number)} ${
                                hasUserCap ? "you set" : "suggested"
                              }`
                            : `${FORMAT_INR((effectiveCap as number) - spent)} left of ${FORMAT_INR(effectiveCap as number)}${
                                hasUserCap ? "" : " (suggested)"
                              }`}
                        </span>
                        {onSaveCap && !isEditingCap && (
                          <button
                            type="button"
                            onClick={() => {
                              setCapInput(String(effectiveCap));
                              setIsEditingCap(true);
                            }}
                            className="shrink-0 text-xs text-primary-300 underline decoration-dotted underline-offset-2"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">No cap set yet</span>
                      {onSaveCap && !isEditingCap && (
                        <button
                          type="button"
                          onClick={() => {
                            setCapInput("");
                            setIsEditingCap(true);
                          }}
                          className="shrink-0 text-xs text-primary-300 underline decoration-dotted underline-offset-2"
                        >
                          Set a cap
                        </button>
                      )}
                    </div>
                  )}

                  {isEditingCap && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 shrink-0">₹</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        autoFocus
                        value={capInput}
                        onChange={(e) => setCapInput(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full h-9 px-2.5 rounded-sm bg-white/5 border border-white/10 text-xs text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCap}
                        disabled={savingCap || !Number(capInput)}
                        className="shrink-0 h-9 px-3 rounded-sm bg-primary-600 text-white text-xs font-semibold disabled:opacity-40"
                      >
                        Save
                      </button>
                      {hasUserCap && (
                        <button
                          type="button"
                          onClick={handleClearCap}
                          disabled={savingCap}
                          className="shrink-0 h-9 px-2.5 rounded-sm bg-white/5 text-rose-300 text-xs font-semibold disabled:opacity-40"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEditingCap(false)}
                        className="shrink-0 h-9 px-2 text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <div className="mt-4 p-3.5 rounded-lg bg-primary-900/30 text-xs leading-relaxed text-gray-200">
                    {!hasCap
                      ? "No cap on this one yet — set one above to start tracking against it."
                      : overCap
                      ? "This one is over. Park it for a week and the run-out date moves back."
                      : "Comfortable. Keep it here and you finish the month with room to spare."}
                  </div>

                  {entries.length > 0 && onSelectEntry && (
                    <div className="mt-3 text-xs text-gray-600">tap an entry to edit or delete</div>
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
                            {/* Bug fix: this used to always show e.subcategory (a fixed
                                generic tag, e.g. "Swiggy/Zomato") as the headline even
                                when the user typed their own note — the note only ever
                                showed up in the subtitle. The user's own words are now
                                the headline whenever they gave one; the generic tag
                                moves to the subtitle instead of disappearing. */}
                            <div className="text-xs text-gray-100 truncate">{e.note || e.subcategory || category.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {e.note && e.subcategory ? ` · ${e.subcategory}` : ""}
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
              className="w-full h-11 mt-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
