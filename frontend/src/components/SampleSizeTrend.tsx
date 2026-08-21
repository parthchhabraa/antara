"use client";

import React from "react";

interface SampleSizeTrendProps {
  history: { computedAt: string; sampleSize: number }[];
}

// Step 10 item 4 — "current sample size and how it's trending as more survey
// responses come in." History accumulates one point per recompute (see
// survey_etl.save_benchmarks's history subcollection) — this pass will only
// ever have a handful of points since it's the first time this exists; the
// mechanism is what's being built, not a rich trend line yet.
export const SampleSizeTrend: React.FC<SampleSizeTrendProps> = ({ history }) => {
  if (history.length === 0) {
    return <p className="text-xs text-gray-500">No recompute history yet.</p>;
  }
  const maxN = Math.max(...history.map((h) => h.sampleSize), 1);
  const latest = history[history.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-medium text-white">{latest.sampleSize}</span>
        <span className="text-xs text-gray-500">responses as of {new Date(latest.computedAt).toLocaleString()}</span>
      </div>
      {history.length < 2 ? (
        <p className="text-[11px] text-gray-600">Only one recompute so far — trend will show once there's more than one data point.</p>
      ) : (
        <div className="flex items-end gap-1 h-16">
          {history.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-primary-500/60 min-w-[3px]"
              style={{ height: `${Math.max(4, (h.sampleSize / maxN) * 100)}%` }}
              title={`${h.sampleSize} responses at ${new Date(h.computedAt).toLocaleString()}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
