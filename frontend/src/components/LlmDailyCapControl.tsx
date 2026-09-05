"use client";

import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const LAUNCH_CONFIG_REF = doc(db, "admin", "launchConfig");
const DEFAULT_CAP = 30; // mirrors backend/app/rate_limit.py's RATE_LIMIT_LLM_DAILY_DEFAULT

// Brief 4 (2026-09-05) — superadmin control for
// admin/launchConfig.llmDailyMessageCap: the daily per-account cap on
// /api/v1/ml/chat + /api/v1/ml/insights (the two routes that hit the 7B
// model on the one shared GPU). Same live-synced pattern as
// PublicSignupToggle. Backend caches this for up to 60s
// (backend/app/rate_limit.py's _get_llm_daily_cap), so a change here takes
// effect within a minute, no redeploy — that's the actual point of storing
// this in Firestore instead of an env var.
export const LlmDailyCapControl: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [cap, setCap] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubscribe = onSnapshot(
      LAUNCH_CONFIG_REF,
      (snap) => {
        const value = snap.exists() && typeof snap.data().llmDailyMessageCap === "number"
          ? snap.data().llmDailyMessageCap
          : DEFAULT_CAP;
        setCap(value);
        setDraft(String(value));
      },
      (err) => console.warn("launchConfig subscription error:", err)
    );
    return () => unsubscribe();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const handleSave = async () => {
    const parsed = parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert("Enter a whole number greater than 0.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(LAUNCH_CONFIG_REF, { llmDailyMessageCap: parsed }, { merge: true });
    } catch (err) {
      console.error("Failed to update llmDailyMessageCap:", err);
      alert("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const dirty = cap !== null && draft !== String(cap);

  return (
    <div className="p-4 rounded-lg bg-[#0F111A] border border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary-400" />
          <span>Daily Chat/Insights Limit</span>
        </h3>
        <span className="text-xs text-gray-500">{cap === null ? "Loading…" : `currently ${cap}/day`}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={cap === null || saving}
          className="w-24 px-3 py-1.5 rounded-sm bg-white/5 border border-white/10 text-xs text-gray-200 disabled:opacity-40"
        />
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-3 py-1.5 rounded-sm text-xs font-bold bg-primary-600 text-white disabled:opacity-30"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        Per-account daily cap on Ask Antara messages and spend insights — the two routes that run the heavier 7B
        model on the shared GPU. Superadmin is exempt. Backed by{" "}
        <code className="text-gray-400">admin/launchConfig.llmDailyMessageCap</code>; the backend re-reads this at
        most once a minute, so a change here reaches real traffic without a redeploy.
      </p>
    </div>
  );
};
