// Single source of truth for every spring used across the app. Before this
// file existed, `type: "spring"` transitions were hand-tuned per component —
// a grep across the codebase found the same `stiffness: 340, damping: 34`
// pair already independently copy-pasted into 14 different bottom sheets
// (evidence the app had already converged on one de-facto "sheet spring"
// without anyone naming it), plus half a dozen other one-off pairs on the
// nav-dot indicator, the onboarding survey's step/choice transitions, and
// the "thank you" checkmark. That's exactly the "dozen slightly different"
// problem this file exists to end.
//
// Two presets: everything imports `springs.default`; `springs.snappy` is
// reserved for the two moments that reinforce Antara's core habit loop
// (BurnGauge's ring/count-up, StreakBadge's pop on a real streak increment —
// see BurnGauge.tsx/StreakBadge.tsx) and shouldn't be reached for anywhere
// else without going back to whoever's driving that decision — spreading
// "snappy" thin across many moments is still the anti-pattern to avoid, even
// after the retune below.
//
// `default` was retuned after real feedback that the app's first pass at
// this — a near-critically-damped default (damping ratio ≈0.92, no visible
// bounce) — genuinely didn't read as more fluid anywhere: every sheet, the
// nav dot, and the survey all import this constant, so they'd been left
// mathematically almost identical to their pre-consolidation values on
// purpose. That was the deliberate "boring on purpose" reading of the
// original animation brief; explicitly reversed now in favor of visible
// fluidity everywhere this constant is used. Retuned to ratio ≈0.73 — a
// real, felt settle-with-a-touch-of-overshoot on every sheet/chip/nav
// transition, softer than `snappy`'s ≈0.67 so the two core-loop moments
// still read as distinctly livelier than everything else, but no longer
// indistinguishable from "no spring at all."
export interface SpringPreset {
  type: "spring";
  stiffness: number;
  damping: number;
  mass?: number;
}

export const springs = {
  default: {
    type: "spring",
    stiffness: 320,
    damping: 26,
  } satisfies SpringPreset as SpringPreset,
  snappy: {
    type: "spring",
    stiffness: 480,
    damping: 28,
    mass: 0.9,
  } satisfies SpringPreset as SpringPreset,
} as const;
