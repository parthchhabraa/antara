"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup } from "framer-motion";
import { Circle, Orbit, Plus, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { StreakBadge } from "./StreakBadge";
import { AntaraMark } from "./AntaraMark";

interface MobileFrameProps {
  children: React.ReactNode;
  onOpenQuickLog?: () => void;
  immersive?: boolean; // hide both the top header and bottom Today/Pull chrome — for
  // full-bleed screens like the sign-in hero, where the mockup shows no chrome at all
  // and a header would just duplicate the hero's own "Continue with Google" CTA
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children, onOpenQuickLog, immersive = false }) => {
  const pathname = usePathname();
  const { user, profile, isSuperAdmin, isDemoMode, toggleDemoMode, signOut, signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-[#060709] text-gray-100 flex justify-center selection:bg-primary-500 selection:text-white">
      {/* Mobile / Tablet constrained container */}
      <div className={`w-full max-w-md md:max-w-lg min-h-screen flex flex-col bg-[#0A0C10] border-x border-white/5 shadow-2xl relative ${immersive ? "" : "pb-24"}`}>

        {/* Top Header Bar — hidden entirely on immersive screens (see prop doc above) */}
        {!immersive && (
        <header className="sticky top-0 z-30 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Step 11: real Antara mark, replacing the old plain-text "A" chip. No
                background pill needed — the mark's own black/steel-blue split
                already reads as a mark on its own against the near-black header. */}
            <AntaraMark size={30} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">Antara</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">
                  Beta
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium leading-none">
                {profile?.displayName || "Teen FinTech"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!user ? (
              /* No real Firebase session yet: only entry point is Google Sign-In */
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-bold transition-all bg-white text-gray-900 border-white/80 hover:bg-gray-100 shadow-sm"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
            ) : (
              <>
                {/* Streak badge — real accounts only, never demo/guest data. */}
                {!isDemoMode && <StreakBadge streak={profile?.currentStreak ?? 0} />}

                {/* Demo vs Live Data toggle — superadmin-only. A regular beta tester
                    is always in exactly one mode already (Live, once allowlisted) and
                    a manual switch to fake data in front of them is a dev affordance,
                    not something they'd ever intuitively need. */}
                {isSuperAdmin && (
                  <button
                    onClick={toggleDemoMode}
                    title={isDemoMode ? "Currently viewing Demo Data (In-Memory). Click to switch to Live Firestore." : "Currently viewing Live Firestore Data. Click to switch to Demo Data."}
                    className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-bold transition-all shadow-sm ${
                      isDemoMode
                        ? "bg-primary-950/80 text-primary-200 border-primary-500/50 hover:bg-primary-900/80 shadow-glow-primary"
                        : "bg-emerald-950/80 text-emerald-200 border-emerald-500/50 hover:bg-emerald-900/80"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full animate-pulse ${
                        isDemoMode ? "bg-primary-400" : "bg-emerald-400"
                      }`}
                    />
                    <span>{isDemoMode ? "DEMO" : "LIVE"}</span>
                  </button>
                )}

                {/* Superadmin Indicator — now the entry point to /admin since the
                    bottom nav dropped its own Admin tab in the redesign */}
                {isSuperAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold hover:bg-amber-500/30 transition-colors"
                  >
                    <Shield className="w-3 h-3" />
                    Admin
                  </Link>
                )}

                <button
                  onClick={signOut}
                  title="Sign out / Reset"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </header>
        )}

        {/* Main Content Area */}
        <main className="flex-1 px-4 py-4 overflow-y-auto">{children}</main>

        {/* Bottom chrome: Today / Log (center CTA) / Pull. A minimal 2-tab +
            center-action dock, matching the redesign — Admin moved to the
            header badge above since it no longer gets its own nav slot.
            Hidden entirely on the sign-in hero, matching the mockup's own
            chrome-hidden signin state. */}
        {!immersive && (
        <LayoutGroup id="bottom-nav">
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-lg z-30 flex items-start gap-1.5 px-6 pt-3.5 bg-gradient-to-t from-[#0A0C10] via-[#0A0C10]/93 to-transparent">
            <Link
              href="/"
              className={`flex-1 flex flex-col items-center gap-1 py-1 active:scale-95 transition-transform relative ${
                pathname === "/" ? "text-primary-300" : "text-gray-500"
              }`}
            >
              <Circle className="w-5 h-5" strokeWidth={1.6} />
              <span className="text-[10px] tracking-wide">TODAY</span>
              {pathname === "/" && (
                <motion.span
                  layoutId="nav-active-dot"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary-500 absolute -bottom-1.5 shadow-glow-primary"
                />
              )}
            </Link>

            {onOpenQuickLog && (
              <button
                onClick={onOpenQuickLog}
                className="h-[46px] px-5 rounded-full bg-primary-600 text-white text-sm font-bold shadow-glow-primary active:scale-95 transition-transform flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Log
              </button>
            )}

            <Link
              href="/graph"
              className={`flex-1 flex flex-col items-center gap-1 py-1 active:scale-95 transition-transform relative ${
                pathname === "/graph" ? "text-primary-300" : "text-gray-500"
              }`}
            >
              <Orbit className="w-5 h-5" strokeWidth={1.6} />
              <span className="text-[10px] tracking-wide">PULL</span>
              {pathname === "/graph" && (
                <motion.span
                  layoutId="nav-active-dot"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary-500 absolute -bottom-1.5 shadow-glow-primary"
                />
              )}
            </Link>
          </div>
        </LayoutGroup>
        )}

      </div>
    </div>
  );
};
