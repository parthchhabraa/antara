"use client";

import React, { useEffect, useState } from "react";
import { SlidersHorizontal, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { DataConfig, fetchDataConfig, updateDataConfig, recomputeBenchmarks } from "@/lib/api";
import { STARTER_CATEGORIES } from "@/lib/constants";

// Step 10 — superadmin "tailor the data" controls, backed by Firestore
// admin/dataConfig (not hardcoded constants). Saving here calls the backend,
// which persists the config AND immediately recomputes Stage-1 stats against
// it — that recompute-on-save is the actual mechanism, not a redeploy.
export const DataConfigPanel: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [config, setConfig] = useState<DataConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lastRecompute, setLastRecompute] = useState<{ sampleSize: number; computedAt: string } | null>(null);

  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    fetchDataConfig(user)
      .then(setConfig)
      .catch((err) => console.warn("Could not load admin/dataConfig:", err));
  }, [user, isSuperAdmin]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const save = async (partial: Partial<DataConfig>) => {
    if (!user || !config) return;
    setSaving(true);
    try {
      const merged = { ...config, ...partial };
      const { config: saved, recomputedStats } = await updateDataConfig(user, merged);
      setConfig(saved);
      setLastRecompute({ sampleSize: recomputedStats.sampleSize, computedAt: recomputedStats.computedAt });
      showToast(`Saved — recomputed against ${recomputedStats.sampleSize} responses.`);
    } catch (err) {
      console.error("Failed to save data config:", err);
      showToast("Save failed — check connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleRecomputeOnly = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const stats = await recomputeBenchmarks(user);
      setLastRecompute({ sampleSize: stats.sampleSize, computedAt: stats.computedAt });
      showToast(`Recomputed against ${stats.sampleSize} responses (config unchanged).`);
    } catch (err) {
      console.error("Recompute failed:", err);
      showToast("Recompute failed — check connection.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return null; // matches the rest of SuperadminPanel — non-superadmin never sees these sections at all
  }

  if (!config) {
    return (
      <div className="p-4 rounded-lg bg-[#0F111A] border border-white/5 text-xs text-gray-500">
        Loading data config…
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-[#0F111A] border border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary-400" />
          <span>Tailor the Training Data</span>
        </h3>
        <button
          onClick={handleRecomputeOnly}
          disabled={saving}
          className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-sm bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${saving ? "animate-spin" : ""}`} />
          Recompute now
        </button>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Changes here save to <code className="text-gray-400">admin/dataConfig</code> and immediately recompute
        Stage-1 stats — no redeploy needed.
      </p>

      {toast && (
        <div className="p-2 rounded-sm bg-primary-500/20 border border-primary-500/30 text-xs text-primary-200 text-center">
          {toast}
        </div>
      )}
      {lastRecompute && (
        <p className="text-xs text-gray-600">
          Last recompute: {lastRecompute.sampleSize} responses, {new Date(lastRecompute.computedAt).toLocaleString()}
        </p>
      )}

      {/* Income band cutoffs */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-300">Income band cutoffs (₹/month pocket money)</div>
        <div className="flex items-center gap-2 flex-wrap">
          {config.incomeBandLabels.map((label, i) => (
            <React.Fragment key={label}>
              <span className="text-xs px-2 py-1 rounded-sm bg-black/40 text-gray-300 border border-white/5">
                {label}
              </span>
              {i < config.incomeBandCutoffs.length && (
                <input
                  type="number"
                  value={config.incomeBandCutoffs[i]}
                  onChange={(e) => {
                    const next = [...config.incomeBandCutoffs];
                    next[i] = Number(e.target.value);
                    setConfig({ ...config, incomeBandCutoffs: next });
                  }}
                  className="w-20 px-2 py-1 rounded-sm bg-white/5 border border-white/10 text-xs text-white text-center"
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <button
          onClick={() => save({ incomeBandCutoffs: config.incomeBandCutoffs })}
          disabled={saving}
          className="text-xs font-bold px-2.5 py-1 rounded-sm bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40"
        >
          Save cutoffs
        </button>
      </div>

      {/* Outlier handling */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">Outlier handling (Tukey fence)</span>
          <button
            onClick={() =>
              save({ outlierHandling: { ...config.outlierHandling, enabled: !config.outlierHandling.enabled } })
            }
            className={`text-xs font-bold px-2.5 py-1 rounded-sm ${
              config.outlierHandling.enabled ? "bg-primary-600 text-white" : "bg-white/10 text-gray-400"
            }`}
            disabled={saving}
          >
            {config.outlierHandling.enabled ? "On" : "Off"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Exclude beyond</span>
          <input
            type="number"
            step="0.1"
            value={config.outlierHandling.thresholdIQR}
            onChange={(e) =>
              setConfig({
                ...config,
                outlierHandling: { ...config.outlierHandling, thresholdIQR: Number(e.target.value) },
              })
            }
            className="w-16 px-2 py-1 rounded-sm bg-white/5 border border-white/10 text-xs text-white text-center"
          />
          <span className="text-xs text-gray-500">× IQR from Q1/Q3</span>
          <button
            onClick={() => save({ outlierHandling: config.outlierHandling })}
            disabled={saving}
            className="ml-auto text-xs font-bold px-2.5 py-1 rounded-sm bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      {/* Minimum sample size for "confident" */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-300">
          Minimum sample size to label a stat "confident" (below this: "early estimate")
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={config.minSampleSizeConfident}
            onChange={(e) => setConfig({ ...config, minSampleSizeConfident: Number(e.target.value) })}
            className="w-20 px-2 py-1 rounded-sm bg-white/5 border border-white/10 text-xs text-white text-center"
          />
          <button
            onClick={() => save({ minSampleSizeConfident: config.minSampleSizeConfident })}
            disabled={saving}
            className="text-xs font-bold px-2.5 py-1 rounded-sm bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      {/* Per-category trust weights */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-300">
          Per-category trust weight <span className="text-gray-600">(down-weight noisy/joke responses without deleting data)</span>
        </div>
        <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5">
          {STARTER_CATEGORIES.filter((c) => c.id !== "miscellaneous").map((cat) => {
            const weight = config.categoryWeights[cat.id] ?? 1.0;
            return (
              <div key={cat.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-28 truncate">{cat.short}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weight}
                  onChange={(e) => {
                    const next = { ...config.categoryWeights, [cat.id]: Number(e.target.value) };
                    setConfig({ ...config, categoryWeights: next });
                  }}
                  onMouseUp={() => save({ categoryWeights: config.categoryWeights })}
                  onTouchEnd={() => save({ categoryWeights: config.categoryWeights })}
                  className="flex-1 accent-primary-500"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{weight.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
