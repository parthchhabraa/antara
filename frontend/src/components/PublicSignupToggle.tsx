"use client";

import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Globe, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const LAUNCH_CONFIG_REF = doc(db, "admin", "launchConfig");

// Step 12 — superadmin control for admin/launchConfig.publicSignupEnabled.
// Live-synced (onSnapshot) so this always reflects the real current state,
// same pattern as SuperadminPanel's beta allowlist. Defaults closed and
// requires an explicit confirm to flip ON specifically — this is the
// control that decides whether the beta-allowlist gate still applies to
// new sign-ins at all, not something that should be a single accidental
// click either direction, even though it's fully reversible.
export const PublicSignupToggle: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubscribe = onSnapshot(
      LAUNCH_CONFIG_REF,
      (snap) => setEnabled(snap.exists() ? snap.data().publicSignupEnabled === true : false),
      (err) => console.warn("launchConfig subscription error:", err)
    );
    return () => unsubscribe();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const handleToggle = async () => {
    if (enabled === null) return;
    const next = !enabled;
    if (next) {
      const confirmed = window.confirm(
        "Turn ON public signup?\n\nAny Google account will be able to sign in straight to Live Mode — no beta allowlist check. This is reversible (toggle it back off any time), but it's a real change to who can write real transaction data. Continue?"
      );
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      await setDoc(LAUNCH_CONFIG_REF, { publicSignupEnabled: next }, { merge: true });
    } catch (err) {
      console.error("Failed to update publicSignupEnabled:", err);
      alert("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-[#0F111A] border border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary-400" />
          <span>Public Signup</span>
        </h3>
        <button
          onClick={handleToggle}
          disabled={enabled === null || saving}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${
            enabled ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-400"
          }`}
        >
          {enabled === null ? "Loading…" : enabled ? "ON — anyone can sign up" : "OFF — allowlist only"}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        When off (default), sign-in still requires the beta allowlist below — unchanged. When on, any Google
        account skips the allowlist entirely and goes straight to Live Mode. Backed by{" "}
        <code className="text-gray-400">admin/launchConfig</code>, enforced in both the sign-in flow and
        Firestore's own security rules — not just a client-side check.
      </p>
      {enabled && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Public signup is live right now. Real strangers — who may be minors — can create accounts with real
            financial data. Confirm the Privacy Policy / Terms / consent checkbox are actually in place before
            leaving this on for real.
          </span>
        </div>
      )}
    </div>
  );
};
