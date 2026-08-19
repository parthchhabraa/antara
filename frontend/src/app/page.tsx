"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MobileFrame } from "@/components/MobileFrame";
import { QuickLogModal } from "@/components/QuickLogModal";
import { TransactionList } from "@/components/TransactionList";
import { PredictiveInsightsCard } from "@/components/PredictiveInsightsCard";
import { DEMO_TRANSACTIONS, STARTER_CATEGORIES, FORMAT_INR } from "@/lib/constants";
import { Transaction, SpendPrediction } from "@/types";
import { fetchSpendPredictions } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { ArrowUpRight, Network, Sparkles, TrendingUp, Wallet, Flame, Database } from "lucide-react";

export default function DashboardPage() {
  const { user, profile, isDemoMode } = useAuth();
  const [demoTxs, setDemoTxs] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [liveTxs, setLiveTxs] = useState<Transaction[]>([]);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<SpendPrediction | null>(null);
  const [loadingML, setLoadingML] = useState<boolean>(true);

  // Active transactions depend on whether Demo Mode or Live Mode is selected
  const transactions = isDemoMode ? demoTxs : liveTxs;

  // Listen to live Firestore transactions when in Live Mode
  useEffect(() => {
    if (isDemoMode || !user) return;

    try {
      const txCol = collection(db, "users", user.uid, "transactions");
      const q = query(txCol, orderBy("timestamp", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetched: Transaction[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Transaction, "id">),
          }));
          setLiveTxs(fetched);
        },
        (err) => {
          console.warn("Firestore live subscription notice:", err);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn("Error setting up Firestore listener:", e);
    }
  }, [isDemoMode, user]);

  const monthlyBudget = profile?.monthly_budget || 5000;
  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const remainingBudget = Math.max(0, monthlyBudget - totalSpent);
  const budgetProgress = Math.min(100, Math.round((totalSpent / monthlyBudget) * 100));

  // Compute or fetch ML predictions based on active transactions
  useEffect(() => {
    async function loadML() {
      setLoadingML(true);
      const res = await fetchSpendPredictions(profile?.uid || "demo-user", transactions, monthlyBudget);
      setPrediction(res);
      setLoadingML(false);
    }
    loadML();
  }, [transactions, profile, monthlyBudget]);

  const handleAddTransaction = async (newTx: Omit<Transaction, "id">) => {
    if (isDemoMode) {
      const txWithId: Transaction = {
        ...newTx,
        id: "tx-" + Date.now(),
      };
      setDemoTxs([txWithId, ...demoTxs]);
    } else if (user) {
      try {
        const txCol = collection(db, "users", user.uid, "transactions");
        await addDoc(txCol, newTx);
      } catch (err) {
        console.error("Error writing to Firestore:", err);
        // Fallback to local state if offline
        const txWithId: Transaction = {
          ...newTx,
          id: "tx-" + Date.now(),
        };
        setLiveTxs([txWithId, ...liveTxs]);
      }
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (isDemoMode) {
      setDemoTxs(demoTxs.filter((t) => t.id !== id));
    } else if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "transactions", id));
      } catch (err) {
        console.error("Error deleting from Firestore:", err);
        setLiveTxs(liveTxs.filter((t) => t.id !== id));
      }
    }
  };

  return (
    <MobileFrame onOpenQuickLog={() => setIsQuickLogOpen(true)}>
      <div className="space-y-5">
        
        {/* Main Budget Card */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-gradient-to-br from-[#1E1238] via-[#121424] to-[#0A0C14] border border-purple-500/30 shadow-glow-purple">
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
              August Allowance
            </span>
            <span className="text-xs text-gray-400 font-medium">
              Remaining: <span className="text-emerald-400 font-bold">{FORMAT_INR(remainingBudget)}</span>
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <h1 className="text-3xl font-black tracking-tight text-white">
              {FORMAT_INR(totalSpent)}
            </h1>
            <span className="text-xs text-gray-400 font-medium">spent of {FORMAT_INR(monthlyBudget)}</span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetProgress > 85
                    ? "bg-gradient-to-r from-rose-500 to-amber-500"
                    : "bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400"
                }`}
                style={{ width: `${budgetProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{budgetProgress}% used</span>
              <span>Daily target: ₹{Math.round(remainingBudget / 15)}/day</span>
            </div>
          </div>
        </div>

        {/* Signature Obsidian Dot Graph Banner / Preview */}
        <Link
          href="/graph"
          className="block p-4 rounded-2xl bg-gradient-to-r from-[#141226] via-[#101322] to-[#0C1524] border border-cyan-500/30 hover:border-cyan-400/60 shadow-glow-cyan transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Network className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs uppercase font-bold text-cyan-300">Obsidian Dot Graph</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                    Live Physics
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Explore your spending behavior in force-directed node space
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </Link>

        {/* Top Spending Categories Scroller */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Top Categories
            </span>
            <span className="text-[11px] text-gray-500">12 Indian Teen Categories</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {STARTER_CATEGORIES.slice(0, 6).map((cat) => (
              <div
                key={cat.id}
                className="flex-shrink-0 p-3 rounded-2xl bg-[#0E1019] border border-white/5 w-32 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-[9px] font-semibold text-gray-500">
                    {cat.is_essential ? "Need" : "Want"}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-200 line-clamp-1">{cat.name}</p>
                <p className="text-[10px] text-gray-400">
                  {FORMAT_INR(
                    transactions
                      .filter((t) => t.category === cat.id)
                      .reduce((a, b) => a + b.amount, 0)
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ML Predictive Insights Card */}
        <PredictiveInsightsCard prediction={prediction} monthlyBudget={monthlyBudget} />

        {/* Recent Transactions List */}
        <TransactionList
          transactions={transactions}
          onDeleteTransaction={handleDeleteTransaction}
        />

        {/* Quick Log Modal */}
        <QuickLogModal
          isOpen={isQuickLogOpen}
          onClose={() => setIsQuickLogOpen(false)}
          onAddTransaction={handleAddTransaction}
        />

      </div>
    </MobileFrame>
  );
}
