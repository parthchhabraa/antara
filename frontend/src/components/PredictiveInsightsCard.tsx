"use client";

import React from "react";
import { SpendPrediction } from "@/types";
import { FORMAT_INR } from "@/lib/constants";
import { TrendingUp, AlertTriangle, CheckCircle2, Flame, Sparkles } from "lucide-react";

interface PredictiveInsightsCardProps {
  prediction: SpendPrediction | null;
  monthlyBudget: number;
}

export const PredictiveInsightsCard: React.FC<PredictiveInsightsCardProps> = ({
  prediction,
  monthlyBudget,
}) => {
  if (!prediction) {
    return (
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center text-xs text-gray-500">
        Calculating ML Spend Projection...
      </div>
    );
  }

  const isOverBudget = prediction.predicted_total_spend > monthlyBudget;
  const burnRate = prediction.current_burn_rate_daily;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-[#141724] to-[#0D0F18] border border-purple-500/20 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs uppercase font-bold tracking-wider text-purple-300">
                Antara Spend Prediction
              </h3>
              {prediction.is_cold_start ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  Cold-Start Heuristic
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Trained ML V1
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              {prediction.is_cold_start
                ? `Data maturity: ${prediction.data_days_logged}/14 days logged (${Math.round(prediction.confidence_score * 100)}% confidence)`
                : `Active ML model trained on ${prediction.data_days_logged} days of transactions`}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
            isOverBudget
              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          }`}
        >
          {isOverBudget ? "High Velocity" : "Budget Safe"}
        </span>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <span className="text-[10px] text-gray-400 font-medium">Projected Spend</span>
          <p className="text-lg font-black text-white mt-0.5">
            {FORMAT_INR(prediction.predicted_total_spend)}
          </p>
          <span className="text-[10px] text-gray-500">Budget: {FORMAT_INR(monthlyBudget)}</span>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
            <Flame className="w-3 h-3 text-orange-400" />
            <span>Daily Burn Rate</span>
          </div>
          <p className="text-lg font-black text-white mt-0.5">
            {FORMAT_INR(burnRate)}
            <span className="text-xs font-normal text-gray-400">/day</span>
          </p>
          <span className="text-[10px] text-gray-500">
            ~{prediction.projected_days_until_budget_exhaustion} days left
          </span>
        </div>
      </div>

      {/* Smart Actionable AI Insights */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-gray-300">Smart Insights & Alerts</span>
        <div className="space-y-1.5">
          {prediction.smart_insights.map((insight, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/15 text-[11px] text-gray-300 flex items-start gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
              <div className="leading-snug">{insight}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
