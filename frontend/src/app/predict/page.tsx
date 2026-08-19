"use client";

import React, { useState, useEffect } from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { QuickLogModal } from "@/components/QuickLogModal";
import { DEMO_TRANSACTIONS, FORMAT_INR } from "@/lib/constants";
import { fetchSpendPredictions } from "@/lib/api";
import { SpendPrediction, Transaction } from "@/types";
import { useAuth } from "@/lib/AuthContext";
import { Sparkles, TrendingUp, AlertTriangle, ArrowLeft, ShieldAlert, PieChart } from "lucide-react";
import Link from "next/link";

export default function PredictPage() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [prediction, setPrediction] = useState<SpendPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState<boolean>(false);

  const monthlyBudget = profile?.monthly_budget || 5000;

  useEffect(() => {
    async function loadML() {
      setLoading(true);
      const res = await fetchSpendPredictions(profile?.uid || "demo-user", transactions, monthlyBudget);
      setPrediction(res);
      setLoading(false);
    }
    loadML();
  }, [transactions, profile, monthlyBudget]);

  const handleAddTransaction = (newTx: Omit<Transaction, "id">) => {
    const txWithId: Transaction = {
      ...newTx,
      id: "tx-" + Date.now(),
    };
    setTransactions([txWithId, ...transactions]);
  };

  return (
    <MobileFrame onOpenQuickLog={() => setIsQuickLogOpen(true)}>
      <div className="space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>ML Spend Forecast</span>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              </h1>
              <p className="text-[11px] text-gray-400">Next 30-day budget velocity projection</p>
            </div>
          </div>
        </div>

        {/* Prediction Summary Banner */}
        {prediction && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1B1130] to-[#0D0F18] border border-purple-500/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-purple-300">Projected Month-End Spend</span>
              <span className="text-xs font-bold text-white">{FORMAT_INR(prediction.predicted_total_spend)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>Budget Allowance</span>
              <span>{FORMAT_INR(monthlyBudget)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>Estimated Exhaustion Date</span>
              <span className="text-amber-300 font-semibold">
                In ~{prediction.projected_days_until_budget_exhaustion} days
              </span>
            </div>
          </div>
        )}

        {/* Category Breakdown Table / Risk Badges */}
        <div className="p-4 rounded-2xl bg-[#0E1019] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-purple-400" />
              <span>Category Velocity & Risk Scores</span>
            </span>
          </div>

          <div className="space-y-2">
            {prediction?.category_breakdown.map((cat) => (
              <div
                key={cat.category_id}
                className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-gray-200">{cat.category_name}</p>
                  <p className="text-[10px] text-gray-500">
                    Logged: {FORMAT_INR(cat.historical_spend)} • Trend: +{cat.trend_pct}%
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-black text-white">{FORMAT_INR(cat.predicted_spend)}</p>
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      cat.risk_level === "high"
                        ? "bg-rose-500/20 text-rose-300"
                        : cat.risk_level === "medium"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {cat.risk_level} risk
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

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
