"use client";

import React, { useState, useMemo } from "react";
import { Stage1Stats, CategoryStat } from "@/lib/api";
import { STARTER_CATEGORIES, FORMAT_INR } from "@/lib/constants";

interface CategoryDistributionChartProps {
  stats: Stage1Stats;
}

// Step 10 item 4 — per-category median/spread across income bands. Sample
// size is surfaced everywhere per the brief's explicit instruction: every
// bar's label carries its n, and confidence tier (confident vs. early
// estimate) is a visibly different treatment, not just a tooltip footnote.
export const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({ stats }) => {
  const bandOptions = ["overall", ...Object.keys(stats.byIncomeBand)];
  const [band, setBand] = useState<string>("overall");

  const categoryStats: Record<string, CategoryStat> =
    band === "overall" ? stats.overall : stats.byIncomeBand[band]?.categories || {};

  const rows = useMemo(() => {
    return STARTER_CATEGORIES.filter((c) => c.id !== "miscellaneous")
      .map((c) => ({ cat: c, stat: categoryStats[c.id] }))
      .filter((r) => r.stat && !r.stat.insufficientData)
      .sort((a, b) => (b.stat!.median ?? 0) - (a.stat!.median ?? 0));
  }, [categoryStats]);

  const maxVal = Math.max(1, ...rows.map((r) => r.stat!.q3 ?? r.stat!.median ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {bandOptions.map((b) => (
          <button
            key={b}
            onClick={() => setBand(b)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              band === b
                ? "bg-primary-500/20 border-primary-500 text-primary-200"
                : "bg-white/5 border-white/10 text-gray-400"
            }`}
          >
            {b === "overall" ? `Overall (n=${stats.sampleSize})` : `${b} (n=${stats.byIncomeBand[b]?.respondentCount ?? 0})`}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">No data for this band yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ cat, stat }) => {
            const s = stat!;
            const medianPct = ((s.median ?? 0) / maxVal) * 100;
            const q1Pct = ((s.q1 ?? s.median ?? 0) / maxVal) * 100;
            const q3Pct = ((s.q3 ?? s.median ?? 0) / maxVal) * 100;
            const confident = s.confidenceTier === "confident";
            return (
              <div key={cat.id}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[12px] text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.short}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        confident ? "bg-primary-500/15 text-primary-300" : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      n={s.sampleSizeUsed}
                      {s.outliersRemoved ? ` (−${s.outliersRemoved} outlier${s.outliersRemoved > 1 ? "s" : ""})` : ""} ·{" "}
                      {confident ? "confident" : "early estimate"}
                    </span>
                    <span className="text-[11px] font-medium text-white">{FORMAT_INR(s.median ?? 0)}</span>
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                  {!s.insufficientForIQR && (
                    <div
                      className="absolute inset-y-0 rounded-full bg-white/10"
                      style={{ left: `${q1Pct}%`, width: `${Math.max(0, q3Pct - q1Pct)}%` }}
                      title={`IQR: ${FORMAT_INR(s.q1 ?? 0)} – ${FORMAT_INR(s.q3 ?? 0)}`}
                    />
                  )}
                  <div
                    className="absolute inset-y-0 w-[3px] rounded-full"
                    style={{ left: `calc(${medianPct}% - 1.5px)`, backgroundColor: cat.color }}
                  />
                </div>
                {s.insufficientForIQR && (
                  <p className="text-[9px] text-gray-600 mt-0.5">Too few responses (n&lt;4) to show a spread — median only.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
