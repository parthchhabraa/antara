"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { User as FirebaseUser } from "firebase/auth";
import { ChevronLeft, Pin, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { STARTER_CATEGORIES, FORMAT_INR } from "@/lib/constants";
import { CategoryIcon } from "./CategoryIcon";
import {
  BudgetInstance,
  AllocateBudgetResult,
  saveInstance,
  deleteInstance,
  fetchBudgetAllocation,
} from "@/lib/api";
import { Transaction } from "@/types";

interface InstancesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  monthlyBudget: number;
  isDemoMode: boolean;
  user: FirebaseUser | null;
  activeInstanceId?: string;
  onApply: (instanceId: string, allocation: Record<string, number>) => Promise<void>;
}

// "Instances" — a user pins exact amounts to whichever categories they
// choose ("₹2,000 to Food, ₹500 to Recharges"); everything else is a real
// ML-suggested split of what's left (POST /api/v1/ml/allocate-budget),
// proportional to that category's own historical spend, not an even
// split. Applying an instance writes its full resulting allocation into
// category_caps — the same field CategoryDetailSheet's cap editor already
// reads/writes — so the rest of the app's existing budget/cap language
// picks it up automatically rather than a second, parallel display.
export const InstancesSheet: React.FC<InstancesSheetProps> = ({
  isOpen,
  onClose,
  transactions,
  monthlyBudget,
  isDemoMode,
  user,
  activeInstanceId,
  onApply,
}) => {
  const [view, setView] = useState<"list" | "edit">("list");
  const [instances, setInstances] = useState<BudgetInstance[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pinned, setPinned] = useState<Record<string, number>>({});
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [preview, setPreview] = useState<AllocateBudgetResult | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset to the list whenever the sheet is (re)opened, and load the
  // user's own real saved instances live — same onSnapshot pattern
  // page.tsx/graph/page.tsx already use for transactions.
  useEffect(() => {
    if (!isOpen) return;
    setView("list");
    if (isDemoMode || !user) return;
    const col = collection(db, "users", user.uid, "instances");
    const q = query(col, orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setInstances(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BudgetInstance, "id">) })));
    });
    return () => unsubscribe();
  }, [isOpen, isDemoMode, user]);

  // Debounced live preview of the ML-suggested remainder, refetched
  // whenever the pins actually change — same 600ms debounce pattern
  // QuickLogSheet already uses for its note->category suggestion.
  useEffect(() => {
    if (view !== "edit" || !user || isDemoMode) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewState("loading");
      fetchBudgetAllocation(user, transactions, monthlyBudget, pinned)
        .then((r) => {
          setPreview(r);
          setPreviewState("ready");
        })
        .catch((err) => {
          console.warn("Allocation preview failed:", err);
          setPreviewState("error");
        });
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pinned, monthlyBudget, user, isDemoMode]);

  const openNew = () => {
    setEditingId(null);
    setName("");
    setPinned({});
    setPreview(null);
    setPreviewState("idle");
    setView("edit");
  };

  const openExisting = (inst: BudgetInstance) => {
    setEditingId(inst.id);
    setName(inst.name);
    setPinned({ ...inst.pinned });
    setPreview(null);
    setPreviewState("idle");
    setView("edit");
  };

  const togglePin = (categoryId: string) => {
    if (pinned[categoryId] !== undefined) {
      setPinned((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
      setPinningId(null);
    } else {
      setPinningId(categoryId);
      setPinInput("");
    }
  };

  const confirmPin = () => {
    const amount = Number(pinInput);
    if (!pinningId || !amount || amount <= 0) return;
    setPinned((prev) => ({ ...prev, [pinningId]: amount }));
    setPinningId(null);
    setPinInput("");
  };

  const pinnedTotal = useMemo(() => Object.values(pinned).reduce((s, v) => s + v, 0), [pinned]);

  const handleSaveAndApply = async () => {
    if (!name.trim() || !preview || saving) return;
    setSaving(true);
    try {
      const id = await saveInstance(user!.uid, { name: name.trim(), pinned }, editingId || undefined);
      const allocation: Record<string, number> = {};
      preview.allocations.forEach((a) => {
        if (a.amount > 0) allocation[a.category_id] = a.amount;
      });
      await onApply(id, allocation);
      setView("list");
    } catch (err) {
      console.warn("Save & apply instance failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteInstance(user.uid, id);
    } catch (err) {
      console.warn("Delete instance failed:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[75]">
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
            className="absolute left-0 right-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            {isDemoMode || !user ? (
              <>
                <h5 className="text-lg font-medium text-white m-0">Instances</h5>
                <p className="py-8 text-center text-xs text-gray-500">
                  Sign in with a real account to save budget instances — they're written to your own profile.
                </p>
              </>
            ) : view === "list" ? (
              <>
                <h5 className="text-lg font-medium text-white m-0">Budget instances</h5>
                <p className="text-[13px] text-gray-500 mt-0.5 mb-4">
                  Pin exact amounts to the categories that matter, and Antara fills in the rest from your real
                  spending. Save a few — "Exam month," "Normal month" — and switch between them.
                </p>

                {instances.length === 0 ? (
                  <p className="py-8 text-center text-xs text-gray-500">
                    No instances yet — create one to start splitting your budget.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {instances.map((inst) => (
                      <div
                        key={inst.id}
                        className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.05]"
                      >
                        <button
                          type="button"
                          onClick={() => openExisting(inst)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] text-gray-100 truncate">{inst.name}</span>
                            {activeInstanceId === inst.id && (
                              <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary-500/15 text-primary-300 border border-primary-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-gray-500 mt-0.5 mb-0">
                            {Object.keys(inst.pinned).length} categor{Object.keys(inst.pinned).length === 1 ? "y" : "ies"} pinned
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(inst.id)}
                          className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-rose-300 transition-colors"
                          aria-label={`Delete ${inst.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={openNew}
                  className="w-full h-11 mt-4 rounded-2xl bg-primary-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  + New instance
                </button>
                <button
                  onClick={onClose}
                  className="w-full h-11 mt-2 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className="w-8 h-8 -ml-1.5 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    aria-label="Back"
                  >
                    <ChevronLeft className="w-4.5 h-4.5" />
                  </button>
                  <h5 className="text-lg font-medium text-white m-0">{editingId ? "Edit instance" : "New instance"}</h5>
                </div>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 40))}
                  placeholder="e.g. Exam month"
                  className="w-full h-11 mt-3 px-3.5 rounded-xl bg-white/5 border border-white/10 text-[13.5px] text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60"
                />

                <div className="mt-2 text-[11px] text-gray-600">
                  Budget {FORMAT_INR(monthlyBudget)}/mo · {FORMAT_INR(pinnedTotal)} pinned ·{" "}
                  {FORMAT_INR(Math.max(0, monthlyBudget - pinnedTotal))} left for Antara to split
                </div>

                <div className="mt-3 flex flex-col gap-1.5 max-h-[38vh] overflow-y-auto pr-0.5">
                  {STARTER_CATEGORIES.map((c) => {
                    const isPinned = pinned[c.id] !== undefined;
                    const suggested = preview?.allocations.find((a) => a.category_id === c.id);
                    return (
                      <div key={c.id} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <CategoryIcon category={c} size={22} />
                          <span className="flex-1 min-w-0 text-[13px] text-gray-200 truncate">{c.short}</span>
                          {isPinned ? (
                            <>
                              <span className="text-[12.5px] font-medium text-primary-300 shrink-0">
                                {FORMAT_INR(pinned[c.id])}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePin(c.id)}
                                className="shrink-0 text-[11px] text-gray-500 underline decoration-dotted underline-offset-2"
                              >
                                Unpin
                              </button>
                            </>
                          ) : pinningId === c.id ? null : (
                            <>
                              {previewState === "ready" && suggested && (
                                <span
                                  className={`text-[11.5px] shrink-0 ${
                                    suggested.is_early_estimate ? "text-amber-300/80" : "text-gray-400"
                                  }`}
                                >
                                  {FORMAT_INR(suggested.amount)}
                                  {suggested.is_early_estimate ? " (early est.)" : ""}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => togglePin(c.id)}
                                className="shrink-0 flex items-center gap-1 text-[11px] text-primary-300"
                              >
                                <Pin className="w-3 h-3" />
                                Pin
                              </button>
                            </>
                          )}
                        </div>
                        {pinningId === c.id && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[13px] text-gray-500 shrink-0">₹</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              autoFocus
                              value={pinInput}
                              onChange={(e) => setPinInput(e.target.value)}
                              placeholder="e.g. 2000"
                              className="w-full h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[12.5px] text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60"
                            />
                            <button
                              type="button"
                              onClick={confirmPin}
                              disabled={!Number(pinInput)}
                              className="shrink-0 h-8 px-2.5 rounded-lg bg-primary-600 text-white text-[11.5px] font-semibold disabled:opacity-40"
                            >
                              Set
                            </button>
                            <button
                              type="button"
                              onClick={() => setPinningId(null)}
                              className="shrink-0 h-8 px-1.5 text-[11.5px] text-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {preview?.over_allocated && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[12px] text-rose-200">
                    Pinned amounts already add up to more than the budget — nothing's left for Antara to split
                    across the rest.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveAndApply}
                  disabled={!name.trim() || saving || previewState !== "ready"}
                  className="w-full h-12 mt-4 rounded-2xl bg-primary-600 text-white font-bold text-sm disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-transform"
                >
                  {saving ? "Saving…" : "Save & apply"}
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
