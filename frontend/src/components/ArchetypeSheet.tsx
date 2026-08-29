"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { User as FirebaseUser } from "firebase/auth";
import { fetchDotGraph, DotGraphResult, syncArchetypeBadge } from "@/lib/api";
import { Transaction } from "@/types";

interface ArchetypeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  isDemoMode: boolean;
  user: FirebaseUser | null;
}

// Step 16 (Phase 2 continuation) — the live screen the Phase 2 pass's
// reworded PEER_ARCHETYPES copy (engine.py) actually needed to be checked
// against, and didn't have: POST /api/v1/ml/dot-graph has been built and
// functional since Step 8 (see that route's own docstring in main.py) but
// had zero UI consumers anywhere in the app until this component. Reachable
// from the Pull screen (see graph/page.tsx) — thematically the natural
// home, since this is the same nearest-neighbor-peer-archetype idea Pull's
// own need/want physics is built around, just surfaced explicitly instead
// of only living inside the graph's math.
//
// Same fetch-on-open / loading-ready-error shape as WhyPredictionSheet:
// works for a signed-in Live user with a real Firebase session, shows an
// honest "sign in to see this" state for demo/guest (there's no per-user
// embedding to compute without a real account), and degrades to a plain
// retry message rather than an error screen if the backend call fails.
export const ArchetypeSheet: React.FC<ArchetypeSheetProps> = ({ isOpen, onClose, transactions, isDemoMode, user }) => {
  const [result, setResult] = useState<DotGraphResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!isOpen || isDemoMode || !user) return;
    let cancelled = false;
    setState("loading");
    fetchDotGraph(user, transactions)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setState("ready");
        }
        // Social feature: keeps the friend-readable archetype badge in
        // sync opportunistically, piggybacked on this already-happening
        // real fetch rather than a second automatic call elsewhere — this
        // is the one place the app calls dot-graph today. Best-effort; a
        // failure here shouldn't disrupt the screen the user actually
        // opened this sheet to see.
        if (user) {
          syncArchetypeBadge(user.uid, r.archetype, r.archetype_description, r.is_cold_start).catch((e) =>
            console.warn("Syncing archetype badge failed:", e)
          );
        }
      })
      .catch((err) => {
        console.warn("Archetype sheet fetch failed:", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDemoMode, user]);

  const ranked = result ? [...result.peer_archetypes].sort((a, b) => b.similarity_pct - a.similarity_pct) : [];
  const top = ranked[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[75]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <h5 className="text-lg font-medium text-white m-0">Your spending archetype</h5>
            <p className="text-[13px] text-gray-500 mt-0.5 m-0">
              How your logged spending compares to a few common patterns — not a label, just a pattern-match.
            </p>

            {isDemoMode || !user ? (
              <p className="py-8 text-center text-xs text-gray-500">
                Sign in with a real account to see this — it's computed from your own logged spending.
              </p>
            ) : state === "loading" || state === "idle" ? (
              <p className="py-8 text-center text-xs text-gray-500">One sec, comparing your spending pattern…</p>
            ) : state === "error" ? (
              <p className="py-8 text-center text-xs text-gray-500">
                Couldn't load this right now — try again in a moment.
              </p>
            ) : result && top ? (
              <>
                {result.is_cold_start && (
                  <>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">
                      Early read — not much logged yet
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-amber-200/80 mt-1.5 mb-0">
                      Still calibrating to your data — the more you log, the sharper this gets.
                    </p>
                  </>
                )}

                <div
                  className="mt-4 p-4 rounded-2xl border"
                  style={{ backgroundColor: `${top.color}1a`, borderColor: `${top.color}4d` }}
                >
                  <div className="text-[10px] font-medium tracking-[0.14em]" style={{ color: top.color }}>
                    CLOSEST MATCH · {Math.round(top.similarity_pct)}%
                  </div>
                  <div className="text-lg font-medium text-white mt-1.5">{top.name}</div>
                  <p className="text-[13.5px] leading-relaxed text-gray-200 mt-1.5 mb-0">{top.description}</p>
                </div>

                <div className="text-[10px] font-medium tracking-[0.14em] text-gray-600 mt-5 mb-2">ALL PATTERNS</div>
                <div className="flex flex-col gap-2">
                  {ranked.map((arc) => (
                    <div key={arc.id} className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.05]">
                      <span
                        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: arc.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13.5px] text-gray-100">{arc.name}</span>
                          <span className="text-[11px] text-gray-500 shrink-0">{Math.round(arc.similarity_pct)}%</span>
                        </div>
                        <p className="text-[12px] leading-relaxed text-gray-500 mt-0.5 mb-0">{arc.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <button
              onClick={onClose}
              className="w-full h-11 mt-5 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
