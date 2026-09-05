"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { User as FirebaseUser } from "firebase/auth";
import { fetchLearningCurve, LearningCurvePoint } from "@/lib/api";
import { Transaction } from "@/types";

interface LearningCurveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  isDemoMode: boolean;
  user: FirebaseUser | null;
}

const VIEW_W = 300;
const VIEW_H = 120;
const PAD_X = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

// Same "dots that grow/settle, connected by thin lines" visual language as
// PullCanvas — a real confidence-over-time curve rendered with the same
// motifs the rest of this page already uses, not an unrelated chart style.
// Steel-gray dots (same tone PullCanvas uses for "Need"/untouched) for the
// cold-start heuristic stretch, primary violet ("Want"'s color) once a
// point crosses into the trained model — reusing the page's existing
// two-tone meaning (steel = not yet, violet = active/confident) rather than
// inventing a third color.
const CurveSvg: React.FC<{ points: LearningCurvePoint[] }> = ({ points }) => {
  const { coords, transitionIdx } = useMemo(() => {
    if (points.length === 0) return { coords: [] as { x: number; y: number }[], transitionIdx: -1 };
    const confidences = points.map((p) => p.confidence);
    const lo = Math.min(0.2, ...confidences);
    const hi = Math.max(0.95, ...confidences);
    const span = Math.max(0.01, hi - lo);
    const innerW = VIEW_W - PAD_X * 2;
    const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
    const coords = points.map((p, i) => {
      const x = points.length === 1 ? VIEW_W / 2 : PAD_X + (i / (points.length - 1)) * innerW;
      const y = PAD_TOP + innerH - ((p.confidence - lo) / span) * innerH;
      return { x, y };
    });
    const idx = points.findIndex((p) => p.model_mode === "TRAINED_EMBEDDING_V1");
    return { coords, transitionIdx: idx };
  }, [points]);

  if (coords.length === 0) return null;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img" aria-label="Confidence over time">
      {/* connecting segments, colored by the destination point's own mode */}
      {coords.slice(1).map((c, i) => {
        const prev = coords[i];
        const isTrained = points[i + 1].model_mode === "TRAINED_EMBEDDING_V1";
        return (
          <line
            key={i}
            x1={prev.x}
            y1={prev.y}
            x2={c.x}
            y2={c.y}
            stroke={isTrained ? "rgba(139,92,246,.55)" : "rgba(178,182,202,.35)"}
            strokeWidth={1.5}
          />
        );
      })}
      {/* the real moment the model actually crossed from cold-start heuristic
          into the trained/personalized mode, if this curve has one — a real
          step-change in the underlying formula, not a smoothing artifact. */}
      {transitionIdx > 0 && (
        <line
          x1={coords[transitionIdx].x}
          y1={PAD_TOP - 4}
          x2={coords[transitionIdx].x}
          y2={VIEW_H - PAD_BOTTOM + 4}
          stroke="rgba(139,92,246,.25)"
          strokeDasharray="2,3"
          strokeWidth={1}
        />
      )}
      {coords.map((c, i) => {
        const isTrained = points[i].model_mode === "TRAINED_EMBEDDING_V1";
        const isLast = i === coords.length - 1;
        return (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={isLast ? 5 : 3}
            fill={isTrained ? "#8B5CF6" : "#B2B6CA"}
            opacity={isLast ? 1 : 0.75}
          />
        );
      })}
    </svg>
  );
};

export const LearningCurveSheet: React.FC<LearningCurveSheetProps> = ({
  isOpen,
  onClose,
  transactions,
  isDemoMode,
  user,
}) => {
  const [points, setPoints] = useState<LearningCurvePoint[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!isOpen || isDemoMode || !user) return;
    let cancelled = false;
    setState("loading");
    fetchLearningCurve(user, transactions)
      .then((r) => {
        if (!cancelled) {
          setPoints(r.points);
          setState("ready");
        }
      })
      .catch((err) => {
        console.warn("Learning-curve fetch failed:", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDemoMode, user]);

  const latest = points[points.length - 1];

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
            className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <h5 className="text-lg font-medium text-white m-0">How well Antara knows you</h5>
            <p className="text-xs text-gray-500 mt-0.5 m-0">
              Your own real confidence curve — one point per day you've actually logged something, not a demo chart.
            </p>

            {isDemoMode || !user ? (
              <p className="py-8 text-center text-xs text-gray-500">
                Sign in with a real account to see this — it's built from your own logged days.
              </p>
            ) : state === "loading" || state === "idle" ? (
              <p className="py-8 text-center text-xs text-gray-500">One sec, replaying your logging history…</p>
            ) : state === "error" ? (
              <p className="py-8 text-center text-xs text-gray-500">
                Couldn't load this right now — try again in a moment.
              </p>
            ) : points.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500">
                Log a few expenses across a few different days and this fills in.
              </p>
            ) : (
              <>
                <div className="mt-4 rounded-lg border border-white/10 bg-[radial-gradient(120%_90%_at_50%_0%,#2E1065,#08090C)] p-3">
                  <CurveSvg points={points} />
                </div>

                {latest && (
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium tracking-[0.14em] text-primary-300">
                        RIGHT NOW · {Math.round(latest.confidence * 100)}% CONFIDENT
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {latest.active_days} day{latest.active_days === 1 ? "" : "s"} logged · {latest.tx_count}{" "}
                        transaction{latest.tx_count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
                        latest.model_mode === "TRAINED_EMBEDDING_V1"
                          ? "bg-primary-500/10 text-primary-300 border-primary-500/30"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {latest.model_mode === "TRAINED_EMBEDDING_V1" ? "Personalized" : "Still learning"}
                    </span>
                  </div>
                )}

                {latest && latest.model_mode !== "TRAINED_EMBEDDING_V1" && (
                  <p className="text-xs leading-relaxed text-amber-200/80 mt-2 mb-0">
                    Still calibrating to your data — the more you log, the sharper this gets.
                  </p>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="w-full h-11 mt-5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
