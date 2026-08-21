"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { PageTransition } from "@/components/PageTransition";
import { CategoryDistributionChart } from "@/components/CategoryDistributionChart";
import { SampleSizeTrend } from "@/components/SampleSizeTrend";
import { PopulationDotGraphCanvas } from "@/components/PopulationDotGraphCanvas";
import { useAuth } from "@/lib/AuthContext";
import { fetchTrainingInsights, TrainingInsights } from "@/lib/api";

// Step 10 item 4 — superadmin-only "Training Insights" screen: real current
// data, not a mockup. Everything here is fetched fresh from
// GET /api/v1/admin/training-insights on load (and on manual refresh), which
// itself recomputes Stage-1 stats against whatever's in Firestore right now.
export default function TrainingInsightsPage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [insights, setInsights] = useState<TrainingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    fetchTrainingInsights(user)
      .then(setInsights)
      .catch((err) => {
        console.error("Failed to load training insights:", err);
        setError("Couldn't load training insights — check your connection.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && user && isSuperAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isSuperAdmin]);

  if (!authLoading && !isSuperAdmin) {
    return (
      <MobileFrame>
        <PageTransition>
          <div className="py-16 text-center text-sm text-gray-500">Superadmin access required.</div>
        </PageTransition>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <PageTransition>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-white">Training Insights</h1>
              <p className="text-[11px] text-gray-400">Stage 1 — survey-derived stats, real data only</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading && !insights && <div className="py-16 text-center text-xs text-gray-500">Loading…</div>}
        {error && <div className="py-4 text-center text-xs text-rose-400">{error}</div>}

        {insights && (
          <div className="space-y-5">
            {/* Sample size + trend */}
            <div className="p-4 rounded-2xl bg-[#0F111A] border border-white/5">
              <h3 className="text-xs font-bold text-gray-200 mb-3">Sample size & trend</h3>
              <SampleSizeTrend history={insights.history} />
              {insights.stats.unmappedCategories && Object.keys(insights.stats.unmappedCategories).length > 0 && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300">
                  ⚠ Unmapped category ids found in raw responses (not in the app taxonomy):{" "}
                  {Object.entries(insights.stats.unmappedCategories)
                    .map(([id, n]) => `${id} (${n})`)
                    .join(", ")}
                </div>
              )}
            </div>

            {/* Per-category distribution */}
            <div className="p-4 rounded-2xl bg-[#0F111A] border border-white/5">
              <h3 className="text-xs font-bold text-gray-200 mb-3">
                Per-category median &amp; spread, by income band
              </h3>
              <CategoryDistributionChart stats={insights.stats} />
            </div>

            {/* Population dot graph */}
            <div className="p-4 rounded-2xl bg-[#0F111A] border border-white/5">
              <h3 className="text-xs font-bold text-gray-200 mb-1">Population clustering preview</h3>
              <p className="text-[11px] text-gray-500 mb-3">
                Same archetype clustering as the app's per-user Pull screen, applied across all survey respondents —
                a sanity check before trusting this approach on real per-user data.
              </p>
              <PopulationDotGraphCanvas graph={insights.populationDotGraph} />
            </div>

            <div className="p-3.5 rounded-2xl bg-primary-900/20 border border-primary-800/30 text-[11px] leading-relaxed text-gray-300">
              <strong className="text-primary-300">Stage 1 only.</strong> These are real medians/distributions from{" "}
              {insights.stats.sampleSize} survey responses — presented as "based on {insights.stats.sampleSize} survey
              responses," not as anything trained. Stage 2 (real embedding-based training on live per-user transaction
              history) is intentionally not attempted yet — this sample size doesn't support it.
            </div>
          </div>
        )}
      </PageTransition>
    </MobileFrame>
  );
}
