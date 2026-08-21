"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User as FirebaseUser } from "firebase/auth";
import { FORMAT_INR, STARTER_CATEGORIES } from "@/lib/constants";
import { RiskRow, fetchSpendPrediction, computeCategoryTrend, SpendPrediction } from "@/lib/api";
import { Transaction } from "@/types";
import { CategoryIcon } from "./CategoryIcon";

interface WhyPredictionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  riskRows: RiskRow[];
  transactions: Transaction[];
  monthlyBudget: number;
  today: Date;
  isDemoMode: boolean;
  user: FirebaseUser | null;
}

// Reachable by tapping the coaching line on the Today screen. Always shows
// real, locally-derived top categories (works instantly, no backend needed —
// demo mode included). For a signed-in Live user it also calls the revived
// backend ML endpoint (Step 8) to get an honestly-labeled cold-start vs.
// trained read; if that call is slow, fails, or the user is in demo mode, the
// sheet still shows something real rather than an error or a spinner forever.
export const WhyPredictionSheet: React.FC<WhyPredictionSheetProps> = ({
  isOpen,
  onClose,
  riskRows,
  transactions,
  monthlyBudget,
  today,
  isDemoMode,
  user,
}) => {
  const [prediction, setPrediction] = useState<SpendPrediction | null>(null);
  const [predictionState, setPredictionState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!isOpen || isDemoMode || !user) return;
    let cancelled = false;
    setPredictionState("loading");
    fetchSpendPrediction(user, transactions, monthlyBudget)
      .then((p) => {
        if (!cancelled) {
          setPrediction(p);
          setPredictionState("ready");
        }
      })
      .catch((err) => {
        console.warn("Why-screen prediction fetch failed, falling back to local insights:", err);
        if (!cancelled) setPredictionState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDemoMode, user]);

  const top = riskRows.slice(0, 3);
  const topRow = top[0];
  const trend = topRow ? computeCategoryTrend(transactions, topRow.categoryId, today) : null;
  const topCategory = topRow ? STARTER_CATEGORIES.find((c) => c.id === topRow.categoryId) : undefined;

  let modeLabel = "Preview using demo data";
  let modeTone: "demo" | "early" | "personalized" | "fallback" = "demo";
  if (!isDemoMode) {
    if (predictionState === "loading") {
      modeLabel = "Checking your data…";
      modeTone = "fallback";
    } else if (predictionState === "ready" && prediction) {
      if (prediction.is_cold_start) {
        modeLabel = `Early estimate · logged ${prediction.data_days_logged}/14 days`;
        modeTone = "early";
      } else {
        modeLabel = `Personalized · trained on ${prediction.data_days_logged} days`;
        modeTone = "personalized";
      }
    } else if (predictionState === "error") {
      modeLabel = "Personalized insights unavailable right now — showing what we can tell locally";
      modeTone = "fallback";
    }
  }

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
            className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <h5 className="text-lg font-medium text-white m-0">Why this pace?</h5>
                <p className="text-[13px] text-gray-500 mt-0.5 m-0">What's actually driving your burn rate.</p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
                  modeTone === "personalized"
                    ? "bg-primary-500/10 text-primary-300 border-primary-500/30"
                    : modeTone === "early"
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    : "bg-white/5 text-gray-400 border-white/10"
                }`}
              >
                {modeTone === "personalized" ? "Personalized" : modeTone === "early" ? "Early estimate" : "Preview"}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">{modeLabel}</p>

            {top.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500">Log a few expenses and this will show what's driving your pace.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-col gap-2.5">
                  {top.map((r, i) => {
                    const cat = STARTER_CATEGORIES.find((c) => c.id === r.categoryId);
                    return (
                      <div key={r.categoryId} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.05]">
                        <span className="text-[11px] font-bold text-gray-600 w-4 shrink-0">{i + 1}</span>
                        <CategoryIcon category={cat} size={34} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] text-gray-100 truncate">{r.name}</div>
                          <div className="text-[11px] text-gray-500">{Math.round(r.sharePct)}% of everything logged</div>
                        </div>
                        <span className="text-[13px] font-medium text-white shrink-0">{FORMAT_INR(r.perDay)}/day</span>
                      </div>
                    );
                  })}
                </div>

                {topRow && trend && (
                  <div className="mt-4 p-4 rounded-2xl bg-primary-900/25 border border-primary-800/40">
                    <div className="text-[10px] font-medium tracking-[0.14em] text-primary-300 mb-2">
                      TOP DRIVER — {topRow.name.toUpperCase()}
                    </div>
                    {trend.hasComparison && trend.pctChangeVsPriorTwoWeeks !== null && trend.pctChangeVsPriorTwoWeeks > 5 ? (
                      <p className="text-[13.5px] leading-relaxed text-gray-200 m-0">
                        You've spent {FORMAT_INR(trend.last7Spend)} on {topRow.name.toLowerCase()} this week —{" "}
                        <span className="text-white font-semibold">{trend.pctChangeVsPriorTwoWeeks}% more</span> than your{" "}
                        {FORMAT_INR(trend.priorTwoWeekAvg || 0)}/week average the two weeks before. Try capping it around{" "}
                        <span className="text-white font-semibold">{FORMAT_INR(trend.priorTwoWeekAvg || 0)}</span> a week to get back on pace.
                      </p>
                    ) : trend.hasComparison ? (
                      <p className="text-[13.5px] leading-relaxed text-gray-200 m-0">
                        You've spent {FORMAT_INR(trend.last7Spend)} on {topRow.name.toLowerCase()} this week — about the same as your{" "}
                        {FORMAT_INR(trend.priorTwoWeekAvg || 0)}/week average lately. Nothing urgent here.
                      </p>
                    ) : (
                      <p className="text-[13.5px] leading-relaxed text-gray-200 m-0">
                        Not enough history yet to compare to previous weeks — that needs a few more weeks of logging. Right now{" "}
                        {topRow.name.toLowerCase()} is {Math.round(topRow.sharePct)}% of everything you've logged
                        {topRow.perDay > 0 ? `, at about ${FORMAT_INR(topRow.perDay)}/day` : ""}. Keeping it near{" "}
                        {FORMAT_INR(Math.round(topRow.spent * 0.85))} for the rest of the month would help the run-out date —
                        a rough starting point, not a personalized target yet.
                      </p>
                    )}
                  </div>
                )}

                {predictionState === "ready" && prediction && prediction.smart_insights.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {prediction.smart_insights.slice(0, 2).map((line, i) => (
                      <p key={i} className="text-[12.5px] leading-relaxed text-gray-400 m-0">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="w-full h-11 mt-5 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
