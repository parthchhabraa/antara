"use client";

import React, { useState } from "react";
import { Shield, UserCheck, Plus, Trash2, Server, Database, Radio } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export const SuperadminPanel: React.FC = () => {
  const { profile, isSuperAdmin, isDemoMode, toggleDemoMode } = useAuth();
  const [allowlist, setAllowlist] = useState<string[]>([
    "parthchhabra6112@gmail.com",
    "tester.teen1@antara.app",
    "beta.delhi@antara.app",
  ]);
  const [newEmail, setNewEmail] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string>("");

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) return;
    if (allowlist.includes(newEmail.trim())) {
      setToastMsg("Email already in allowlist");
      return;
    }
    setAllowlist([...allowlist, newEmail.trim()]);
    setNewEmail("");
    setToastMsg("Beta tester added successfully!");
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleRemoveEmail = (email: string) => {
    if (email === "parthchhabra6112@gmail.com") {
      alert("Cannot remove root superadmin email.");
      return;
    }
    setAllowlist(allowlist.filter((e) => e !== email));
  };

  return (
    <div className="space-y-5">
      {/* Superadmin Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Superadmin Control Deck</h2>
            <p className="text-xs text-purple-300">Custom Auth Claim: role = 'superadmin'</p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Root Access
        </span>
      </div>

      {/* Mode Switcher */}
      <div className="p-4 rounded-2xl bg-[#0F111A] border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-gray-200">Execution Mode (Demo vs True)</h3>
            <p className="text-[11px] text-gray-400">
              Toggle between in-memory demo telemetry and live Firestore operations
            </p>
          </div>
          <button
            onClick={toggleDemoMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isDemoMode
                ? "bg-purple-600 text-white shadow-glow-purple"
                : "bg-emerald-600 text-white"
            }`}
          >
            {isDemoMode ? "Demo Mode Active" : "True Mode Active"}
          </button>
        </div>
      </div>

      {/* Backend & Tunnel Telemetry */}
      <div className="p-4 rounded-2xl bg-[#0F111A] border border-white/5 space-y-3">
        <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>Server Telemetry & Port Guard</span>
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] text-gray-400">ML Backend Service</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white">Port 8001 (Active)</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] text-gray-400">Guarded Ports</span>
            <div className="font-bold text-gray-300 mt-1">5000 / 8000 (Reserved)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] text-gray-400">Cloudflare Tunnel</span>
            <div className="font-bold text-cyan-300 mt-1">cloudflared / 8001</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] text-gray-400">Memory Sync</span>
            <div className="font-bold text-purple-300 mt-1">/root/antara/.env-remember</div>
          </div>
        </div>
      </div>

      {/* Beta Allowlist Manager */}
      <div className="p-4 rounded-2xl bg-[#0F111A] border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-400" />
            <span>Beta Tester Allowlist ({allowlist.length})</span>
          </h3>
        </div>

        {toastMsg && (
          <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-[11px] text-purple-200 text-center">
            {toastMsg}
          </div>
        )}

        <form onSubmit={handleAddEmail} className="flex gap-2">
          <input
            type="email"
            placeholder="teen.tester@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {allowlist.map((email) => (
            <div
              key={email}
              className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
            >
              <span className="text-gray-300 font-mono text-[11px]">{email}</span>
              {email === "parthchhabra6112@gmail.com" ? (
                <span className="text-[10px] text-amber-400 font-semibold">Superadmin</span>
              ) : (
                <button
                  onClick={() => handleRemoveEmail(email)}
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
