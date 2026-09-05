"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Shield, UserCheck, Plus, Trash2, Server, Database, Radio, LineChart, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { BetaAllowlistEntry } from "@/types";
import { DataConfigPanel } from "./DataConfigPanel";
import { PublicSignupToggle } from "./PublicSignupToggle";
import { LlmDailyCapControl } from "./LlmDailyCapControl";

const ALLOWLIST_DOC_REF = doc(db, "admin", "betaAllowlist");
const ROOT_SUPERADMIN_EMAIL = "parthchhabra6112@gmail.com";

export const SuperadminPanel: React.FC = () => {
  const { profile, isSuperAdmin, isDemoMode, toggleDemoMode } = useAuth();
  const [allowlist, setAllowlist] = useState<BetaAllowlistEntry[]>([]);
  const [newEmail, setNewEmail] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string>("");

  // Live-sync the allowlist from Firestore (admin/betaAllowlist)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      ALLOWLIST_DOC_REF,
      (snap) => {
        if (snap.exists()) {
          setAllowlist((snap.data().entries as BetaAllowlistEntry[]) || []);
        } else if (isSuperAdmin) {
          // Seed the doc so the root superadmin always shows up in the panel
          const seed: BetaAllowlistEntry[] = [
            { email: ROOT_SUPERADMIN_EMAIL, added_at: new Date().toISOString(), added_by: "system" },
          ];
          persistAllowlist(seed).catch((err) =>
            console.warn("Could not seed betaAllowlist doc:", err)
          );
        }
      },
      (err) => console.warn("Allowlist subscription error:", err)
    );
    return () => unsubscribe();
  }, [isSuperAdmin]);

  // `emails` is the flat array firestore.rules checks against (cheap membership
  // test); `entries` carries the added_at/added_by metadata for this panel's UI.
  // Both are written together so they never drift apart.
  const persistAllowlist = async (entries: BetaAllowlistEntry[]) => {
    await setDoc(ALLOWLIST_DOC_REF, {
      entries,
      emails: entries.map((e) => e.email),
    });
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (allowlist.some((entry) => entry.email.toLowerCase() === email)) {
      setToastMsg("Email already in allowlist");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }
    const newEntry: BetaAllowlistEntry = {
      email,
      added_at: new Date().toISOString(),
      added_by: profile?.email || "superadmin",
    };
    try {
      await persistAllowlist([...allowlist, newEntry]);
      setNewEmail("");
      setToastMsg("Beta tester added successfully!");
    } catch (err) {
      console.error("Failed to persist allowlist:", err);
      setToastMsg("Failed to save — check connection");
    }
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleRemoveEmail = async (email: string) => {
    if (email === ROOT_SUPERADMIN_EMAIL) {
      alert("Cannot remove root superadmin email.");
      return;
    }
    try {
      await persistAllowlist(allowlist.filter((entry) => entry.email !== email));
    } catch (err) {
      console.error("Failed to persist allowlist:", err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Superadmin Header */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary-950/60 to-primary-950/60 border border-primary-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-primary-500/20 text-primary-300 border border-primary-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Superadmin Control Deck</h2>
            <p className="text-xs text-primary-300">Custom Auth Claim: role = 'superadmin'</p>
          </div>
        </div>
        <span className="text-xs uppercase font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Root Access
        </span>
      </div>

      {/* Mode Switcher */}
      <div className="p-4 rounded-lg bg-[#0F111A] border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-gray-200">Execution Mode (Demo vs True)</h3>
            <p className="text-xs text-gray-400">
              Toggle between in-memory demo telemetry and live Firestore operations
            </p>
          </div>
          <button
            onClick={toggleDemoMode}
            className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all ${
              isDemoMode
                ? "bg-primary-600 text-white"
                : "bg-emerald-600 text-white"
            }`}
          >
            {isDemoMode ? "Demo Mode Active" : "True Mode Active"}
          </button>
        </div>
      </div>

      {/* Backend & Tunnel Telemetry */}
      <div className="p-4 rounded-lg bg-[#0F111A] border border-white/5 space-y-3">
        <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>Server Telemetry & Port Guard</span>
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-sm bg-black/40 border border-white/5">
            <span className="text-xs text-gray-400">ML Backend Service</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white">Port 8001 (Active)</span>
            </div>
          </div>
          <div className="p-2.5 rounded-sm bg-black/40 border border-white/5">
            <span className="text-xs text-gray-400">Guarded Ports</span>
            <div className="font-bold text-gray-300 mt-1">5000 / 8000 (Reserved)</div>
          </div>
          <div className="p-2.5 rounded-sm bg-black/40 border border-white/5">
            <span className="text-xs text-gray-400">Cloudflare Tunnel</span>
            <div className="font-bold text-cyan-300 mt-1">cloudflared / 8001</div>
          </div>
          <div className="p-2.5 rounded-sm bg-black/40 border border-white/5">
            <span className="text-xs text-gray-400">Memory Sync</span>
            <div className="font-bold text-primary-300 mt-1">/root/antara/.env-remember</div>
          </div>
        </div>
      </div>

      {/* Step 10: Training Insights entry point — superadmin only, matching
          DataConfigPanel's own gate (this whole page doesn't otherwise gate
          on role, but these two Step 10 additions shouldn't be the exception
          that starts showing real admin tooling to non-admins). */}
      {isSuperAdmin && (
        <Link
          href="/admin/training-insights"
          className="p-4 rounded-lg bg-[#0F111A] border border-white/5 flex items-center justify-between hover:border-primary-500/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary-500/10 text-primary-300 border border-primary-500/20">
              <LineChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-200">Training Insights</h3>
              <p className="text-xs text-gray-500">Survey distributions, sample size trend, population dot-graph</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </Link>
      )}

      {/* Step 10: superadmin "tailor the data" controls */}
      <DataConfigPanel />

      {/* Step 12: public-launch toggle — sits right before the allowlist it's
          an alternative gate to, so the relationship between the two is
          visually obvious. */}
      <PublicSignupToggle />

      {/* Brief 4 (2026-09-05): the LLM daily-cap control this brief's
          rate-limiting layer reads from — sits next to the public-signup
          toggle since both are launchConfig fields controlling who can do
          what once they're in Live Mode. */}
      <LlmDailyCapControl />

      {/* Beta Allowlist Manager */}
      <div className="p-4 rounded-lg bg-[#0F111A] border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary-400" />
            <span>Beta Tester Allowlist ({allowlist.length})</span>
          </h3>
        </div>

        {toastMsg && (
          <div className="p-2 rounded-sm bg-primary-500/20 border border-primary-500/30 text-xs text-primary-200 text-center">
            {toastMsg}
          </div>
        )}

        <form onSubmit={handleAddEmail} className="flex gap-2">
          <input
            type="email"
            placeholder="teen.tester@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 px-3 py-2 rounded-sm bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-sm bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {allowlist.map((entry) => (
            <div
              key={entry.email}
              className="p-2 rounded-sm bg-black/40 border border-white/5 flex items-center justify-between text-xs"
            >
              <span className="text-gray-300 font-mono text-xs">{entry.email}</span>
              {entry.email === ROOT_SUPERADMIN_EMAIL ? (
                <span className="text-xs text-amber-400 font-semibold">Superadmin</span>
              ) : (
                <button
                  onClick={() => handleRemoveEmail(entry.email)}
                  className="text-gray-500 hover:text-rose-400 p-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
