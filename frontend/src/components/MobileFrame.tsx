"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { springs } from "@/lib/motion";
import { Circle, Orbit, Plus, Shield, LogOut, MessageCircle, UserCircle2 } from "lucide-react";
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
  // Phase 2 continuation — the header redesign. Previously LIVE/DEMO +
  // ADMIN + sign-out were three separate always-visible pills next to the
  // streak badge, competing for attention on every screen. Folded into one
  // menu behind a single trigger for a superadmin (the only account that
  // ever saw all three at once) — a regular beta tester never had more
  // than streak + sign-out to begin with, so that path is untouched.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#060709] text-gray-100 flex justify-center selection:bg-primary-500 selection:text-white">
      {/* Mobile / Tablet constrained container */}
      <div className={`w-full max-w-md md:max-w-lg min-h-screen flex flex-col bg-[#0A0C10] border-x border-white/5 shadow-2xl relative ${immersive ? "" : "pb-24"}`}>

        {/* Top Header Bar — hidden entirely on immersive screens (see prop doc above).
            WHOOP-style recreation, prompted by a real reachability bug: the app sets
            viewport-fit=cover (see layout.tsx) so it renders edge-to-edge under the
            status bar/notch on a standalone-PWA phone, same as WHOOP's own edge-to-edge
            look — but nothing here was ever padding for that safe area, so the header's
            buttons rendered partly UNDER the system status bar and were genuinely
            untappable there, not just visually cramped. `paddingTop:
            env(safe-area-inset-top)` (falls back to 0 on any browser that doesn't
            support it, i.e. plain desktop) is the actual fix; everything else below is
            the WHOOP-inspired layout the padding made room for — avatar+streak as one
            left-side identity cluster (the avatar IS the profile entry point now,
            replacing the separate icon button), a single right-side status control,
            brand mark moved to its own smaller centered row underneath, same as WHOOP's
            own wordmark-below-the-icon-row treatment. */}
        {!immersive && (
        <header
          className="sticky top-0 z-30 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-white/5"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {user ? (
                <Link
                  href="/profile"
                  title="Your profile"
                  className="w-8 h-8 rounded-full overflow-hidden bg-primary-500/15 border border-primary-500/25 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                >
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-primary-200">
                      {(profile?.displayName || "A").charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <UserCircle2 className="w-4.5 h-4.5 text-gray-600" />
                </div>
              )}
              {/* Streak — real accounts only, never demo/guest data. */}
              {user && !isDemoMode && <StreakBadge streak={profile?.currentStreak ?? 0} />}
            </div>

            <div className="flex items-center gap-2">
              {!user ? (
                /* No real Firebase session yet: only entry point is Google Sign-In */
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-bold transition-all bg-white text-gray-900 border-white/80 hover:bg-gray-100 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              ) : isSuperAdmin ? (
                /* Everything status/admin-related lives behind one trigger — the dot
                   on the trigger itself gives an at-a-glance read of DEMO vs LIVE
                   without a separate always-on pill for it. */
                <div className="relative">
                  <button
                    onClick={() => setIsMenuOpen((v) => !v)}
                    title="Admin & data source"
                    className="relative p-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#0A0C10] ${
                        isDemoMode ? "bg-primary-400" : "bg-emerald-400"
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isMenuOpen && (
                      <>
                        {/* Click-outside-to-close backdrop — invisible, just for the tap target. */}
                        <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-lg bg-[#14161f] border border-white/10 shadow-2xl overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              toggleDemoMode();
                              setIsMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3.5 py-3 text-xs text-gray-200 hover:bg-white/5 transition-colors"
                          >
                            <span>Data source</span>
                            <span
                              className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                                isDemoMode ? "bg-primary-500/20 text-primary-300" : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isDemoMode ? "bg-primary-400" : "bg-emerald-400"}`} />
                              {isDemoMode ? "DEMO" : "LIVE"}
                            </span>
                          </button>
                          <Link
                            href="/admin"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3.5 py-3 text-xs text-gray-200 hover:bg-white/5 border-t border-white/5 transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5 text-amber-300" />
                            Admin dashboard
                          </Link>
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              signOut();
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-3 text-xs text-rose-300 hover:bg-white/5 border-t border-white/5 transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Sign out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Regular beta tester — one control, matching WHOOP's single
                   right-side icon; the avatar on the left is now the profile
                   entry point, so this no longer needs its own button too. */
                <button
                  onClick={signOut}
                  title="Sign out / Reset"
                  className="p-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Brand row — moved below the icon row, smaller, centered; same
              relationship WHOOP's own wordmark has to its icon row above it. */}
          <div className="pb-1.5 flex items-center justify-center gap-1.5">
            <AntaraMark size={16} />
            <span className="font-bold tracking-tight text-white text-xs">Antara</span>
            <span className="text-xs uppercase font-semibold px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">
              Beta
            </span>
          </div>
        </header>
        )}

        {/* Main Content Area */}
        <main className="flex-1 px-4 py-4 overflow-y-auto">{children}</main>

        {/* Bottom chrome: Today / Pull / Ask, three equal tabs, with Log as a
            floating center FAB overlapping the row on top rather than a
            flex sibling wedged between two tabs — the only way to add a
            4th tab (Ask Antara) without either crowding three text labels
            around the FAB or knocking it off-center. Admin moved to the
            header badge above since it no longer gets its own nav slot.
            Hidden entirely on the sign-in hero, matching the mockup's own
            chrome-hidden signin state. */}
        {!immersive && (
        <LayoutGroup id="bottom-nav">
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-lg z-30">
            <div
              className="relative flex items-start gap-1 px-4 pt-3.5 pb-1.5 bg-gradient-to-t from-[#0A0C10] via-[#0A0C10]/93 to-transparent"
              style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom, 0px))" }}
            >
              <Link
                href="/"
                className={`flex-1 flex flex-col items-center gap-1 py-1 active:scale-95 transition-transform relative ${
                  pathname === "/" ? "text-primary-300" : "text-gray-500"
                }`}
              >
                <Circle className="w-5 h-5" strokeWidth={1.6} />
                <span className="text-xs tracking-wide">TODAY</span>
                {pathname === "/" && (
                  <motion.span
                    layoutId="nav-active-dot"
                    transition={springs.default}
                    className="w-1.5 h-1.5 rounded-full bg-primary-500 absolute -bottom-1.5"
                  />
                )}
              </Link>

              <Link
                href="/graph"
                className={`flex-1 flex flex-col items-center gap-1 py-1 active:scale-95 transition-transform relative ${
                  pathname === "/graph" ? "text-primary-300" : "text-gray-500"
                }`}
              >
                <Orbit className="w-5 h-5" strokeWidth={1.6} />
                <span className="text-xs tracking-wide">PULL</span>
                {pathname === "/graph" && (
                  <motion.span
                    layoutId="nav-active-dot"
                    transition={springs.default}
                    className="w-1.5 h-1.5 rounded-full bg-primary-500 absolute -bottom-1.5"
                  />
                )}
              </Link>

              <Link
                href="/chat"
                className={`flex-1 flex flex-col items-center gap-1 py-1 active:scale-95 transition-transform relative ${
                  pathname === "/chat" ? "text-primary-300" : "text-gray-500"
                }`}
              >
                <MessageCircle className="w-5 h-5" strokeWidth={1.6} />
                <span className="text-xs tracking-wide">ASK</span>
                {pathname === "/chat" && (
                  <motion.span
                    layoutId="nav-active-dot"
                    transition={springs.default}
                    className="w-1.5 h-1.5 rounded-full bg-primary-500 absolute -bottom-1.5"
                  />
                )}
              </Link>

              {onOpenQuickLog && (
                <button
                  onClick={onOpenQuickLog}
                  className="absolute left-1/2 -translate-x-1/2 -top-[22px] h-[46px] px-5 rounded-full bg-primary-600 text-white text-sm font-bold active:scale-95 transition-transform flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Log
                </button>
              )}
            </div>
          </div>
        </LayoutGroup>
        )}

      </div>
    </div>
  );
};
