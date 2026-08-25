"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MobileFrame } from "@/components/MobileFrame";
import { PullCanvas } from "@/components/PullCanvas";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { CategoryDetailSheet } from "@/components/CategoryDetailSheet";
import { TransactionEditSheet } from "@/components/TransactionEditSheet";
import { ArchetypeSheet } from "@/components/ArchetypeSheet";
import { PageTransition } from "@/components/PageTransition";
import { DEMO_TRANSACTIONS, DEMO_REFERENCE_DATE, FORMAT_INR, STARTER_CATEGORIES } from "@/lib/constants";
import {
  calculateBurnMetrics,
  addLiveTransaction,
  deleteLiveTransaction,
  updateLiveTransaction,
  computeStreakUpdate,
  streakToastMessage,
  saveStreakUpdate,
} from "@/lib/api";
import { Transaction } from "@/types";
import { useAuth } from "@/lib/AuthContext";

export default function PullPage() {
  const { user, profile, isDemoMode, refreshClaims } = useAuth();
  const [demoTxs, setDemoTxs] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [liveTxs, setLiveTxs] = useState<Transaction[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("gaming-inapp");
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isArchetypeOpen, setIsArchetypeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const transactions = isDemoMode ? demoTxs : liveTxs;
  const monthlyBudget = profile?.monthly_budget || 5000;
  const today = isDemoMode ? DEMO_REFERENCE_DATE : new Date();

  useEffect(() => {
    if (isDemoMode || !user) return;
    try {
      const txCol = collection(db, "users", user.uid, "transactions");
      const q = query(txCol, orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: Transaction[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Transaction, "id">),
        }));
        setLiveTxs(fetched);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore live query on Pull screen:", e);
    }
  }, [isDemoMode, user]);

  const handleCommit = async (newTx: Omit<Transaction, "id">) => {
    let milestoneLine: string | null = null;
    if (isDemoMode) {
      setDemoTxs([{ ...newTx, id: "tx-" + Date.now() }, ...demoTxs]);
    } else if (user) {
      // Same reasoning as Today's handleCommit (lib/api.ts): every real log is
      // training data, so a failed write must not be silently papered over
      // with a local-only fallback that looks like success but never reaches
      // Firebase.
      try {
        await addLiveTransaction(user.uid, newTx);
      } catch (err) {
        console.error("Error writing transaction to Firestore:", err);
        setToast("Couldn't save that — check your connection and try again. Nothing was logged.");
        window.setTimeout(() => setToast(null), 3400);
        return;
      }
      try {
        // Logging from Pull counts toward the streak too, not just from Today.
        const streakResult = computeStreakUpdate(
          {
            currentStreak: profile?.currentStreak,
            longestStreak: profile?.longestStreak,
            lastLoggedDate: profile?.lastLoggedDate,
            streakFreezesAvailable: profile?.streakFreezesAvailable,
          },
          new Date()
        );
        await saveStreakUpdate(user.uid, streakResult);
        await refreshClaims();
        milestoneLine = streakToastMessage(streakResult);
      } catch (err) {
        console.warn("Streak update failed (the transaction itself was saved fine):", err);
      }
    }
    setIsLogOpen(false);
    if (milestoneLine) {
      setToast(milestoneLine);
      window.setTimeout(() => setToast(null), 3400);
    }
  };

  // Step 13 §2 — same handlers, same reasoning, as Today's page.tsx (streak
  // fields untouched on purpose; burn/pace figures recompute automatically
  // since they're derived from `transactions` on every render).
  const handleDeleteTx = async (txId: string) => {
    if (isDemoMode) {
      setDemoTxs((prev) => prev.filter((t) => t.id !== txId));
    } else if (user) {
      await deleteLiveTransaction(user.uid, txId);
    }
    setToast("Entry deleted.");
    window.setTimeout(() => setToast(null), 2400);
  };

  const handleEditTx = async (txId: string, updates: Partial<Omit<Transaction, "id">>) => {
    if (isDemoMode) {
      setDemoTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, ...updates } : t)));
    } else if (user) {
      await updateLiveTransaction(user.uid, txId, updates);
    }
    setToast("Entry updated.");
    window.setTimeout(() => setToast(null), 2400);
  };

  const metrics = calculateBurnMetrics(transactions, monthlyBudget, today);
  const selected = STARTER_CATEGORIES.find((c) => c.id === selectedId) || STARTER_CATEGORIES[0];
  const selSpent = transactions.filter((t) => t.category === selected.id).reduce((s, t) => s + t.amount, 0);
  const selCount = transactions.filter((t) => t.category === selected.id).length;

  const detailCategory = STARTER_CATEGORIES.find((c) => c.id === detailCategoryId) || null;
  const detailEntries = detailCategoryId ? transactions.filter((t) => t.category === detailCategoryId) : [];

  return (
    <MobileFrame onOpenQuickLog={() => setIsLogOpen(true)}>
      <PageTransition>
        <div className="mb-1">
          <h3 className="text-lg font-medium text-white m-0 mb-1.5">Pull</h3>
          <p className="text-[13px] leading-relaxed text-gray-500 m-0">
            Needs settle left, wants drift right, dots grow with rupees. Tap one to see its month.
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-[radial-gradient(120%_90%_at_50%_0%,#1b1e30,#121423)] overflow-hidden">
          <PullCanvas transactions={transactions} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="flex gap-3.5 mt-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-400" />
            Want
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Need
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-gray-600" />
            Untouched
          </span>
        </div>

        <button
          onClick={() => setDetailCategoryId(selected.id)}
          className="w-full text-left mt-4 p-4 rounded-2xl bg-white/[0.06] active:opacity-70 transition-opacity"
        >
          <div className="text-[10px] font-medium tracking-[0.14em] text-primary-300">
            {selected.is_essential ? "NEED" : "WANT"}
          </div>
          <div className="text-lg font-medium text-white mt-1.5">{selected.name}</div>
          <p className="text-[13px] leading-relaxed text-gray-400 mt-1.5 mb-0">
            {selSpent
              ? `${FORMAT_INR(selSpent)} this month — ${
                  metrics.spent ? Math.round((selSpent / metrics.spent) * 100) : 0
                }% of everything, across ${selCount} ${selCount === 1 ? "entry" : "entries"}.`
              : "Nothing here yet this month. Good place to keep it."}
          </p>
          <div className="flex gap-2 mt-3">
            {selected.monthly_cap !== undefined ? (
              <>
                <span className="text-[11px] px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-100">
                  {FORMAT_INR(selected.monthly_cap)} cap
                </span>
                <span
                  className={`text-[11px] px-2.5 py-1 rounded-md ${
                    selSpent > selected.monthly_cap ? "bg-rose-500/20 text-rose-300" : "bg-primary-800/50 text-primary-100"
                  }`}
                >
                  {selSpent > selected.monthly_cap ? "Over cap" : `${FORMAT_INR(selected.monthly_cap - selSpent)} left`}
                </span>
              </>
            ) : (
              <span className="text-[11px] px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-400">No cap set yet</span>
            )}
          </div>
        </button>

        <div className="flex gap-3.5 mt-5">
          <div className="flex-1">
            <div className="text-[10px] tracking-wide text-gray-600">NEEDS</div>
            <div className="text-xl font-medium text-white mt-1">{FORMAT_INR(metrics.need)}</div>
            <div className="text-[11px] text-gray-600">{metrics.needPct}% of spend</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1">
            <div className="text-[10px] tracking-wide text-gray-600">WANTS</div>
            <div className="text-xl font-medium text-primary-300 mt-1">{FORMAT_INR(metrics.want)}</div>
            <div className="text-[11px] text-gray-600">{metrics.wantPct}% of spend</div>
          </div>
        </div>

        <button
          onClick={() => setIsArchetypeOpen(true)}
          className="block mx-auto mt-4 text-[11.5px] text-gray-500 underline decoration-dotted decoration-gray-600 underline-offset-4 active:opacity-60 transition-opacity"
        >
          See your spending archetype
        </button>

        <div className="h-8" />

        <QuickLogSheet
          isOpen={isLogOpen}
          onClose={() => setIsLogOpen(false)}
          onCommit={handleCommit}
          safeDaily={metrics.safeDaily}
        />
        <CategoryDetailSheet
          category={detailCategory}
          entries={detailEntries}
          onClose={() => setDetailCategoryId(null)}
          onSelectEntry={setEditingTx}
        />
        <TransactionEditSheet
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={handleEditTx}
          onDelete={handleDeleteTx}
        />
        <ArchetypeSheet
          isOpen={isArchetypeOpen}
          onClose={() => setIsArchetypeOpen(false)}
          transactions={transactions}
          isDemoMode={isDemoMode}
          user={user}
        />

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-6 right-6 top-[104px] z-[90] p-3.5 rounded-2xl bg-primary-900/95 shadow-2xl text-[13.5px] leading-relaxed text-white"
          >
            {toast}
          </motion.div>
        )}
      </PageTransition>
    </MobileFrame>
  );
}
