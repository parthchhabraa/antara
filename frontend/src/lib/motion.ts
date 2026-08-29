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
// Two presets, deliberately, matching the animation brief's own philosophy:
// most motion in the app should be cheap, native-feeling, and boring on
// purpose — everything imports `springs.default`. `springs.snappy` is
// reserved for the two moments that actually reinforce Antara's core habit
// loop (BurnGauge's ring/count-up, StreakBadge's pop on a real streak
// increment — see BurnGauge.tsx/StreakBadge.tsx) and should not be reached
// for anywhere else without going back to whoever's driving that decision —
// spreading "snappy" thin across many moments is the anti-pattern the brief
// is explicitly avoiding.
//
// Tuned to read as a platform-native (SwiftUI/UIKit-style) spring rather
// than a webby ease curve: `default` sits right at the edge of critical
// damping (damping ratio ≈0.92 at mass 1) — it settles quickly with no
// visible bounce, which is exactly the feel the 14 sheets above had already
// converged on by hand. `snappy` is deliberately a bit underdamped (ratio
// ≈0.67) for one visible overshoot-and-settle "pop" — noticeably livelier,
// reserved for the two moments above.
// Narrow on purpose (not the full JSX `Transition` type) so this shape is
// also directly usable as the third argument to framer-motion's imperative
// `animate(from, to, options)` call (see CountUpNumber.tsx) — that call's
// stricter `AnimationOptions` type rejects the broader `Transition` type's
// orchestration-only fields (`when`, `staggerChildren`, etc.).
export interface SpringPreset {
  type: "spring";
  stiffness: number;
  damping: number;
  mass?: number;
}

export const springs = {
  default: {
    type: "spring",
    stiffness: 340,
    damping: 34,
  } satisfies SpringPreset as SpringPreset,
  snappy: {
    type: "spring",
    stiffness: 480,
    damping: 28,
    mass: 0.9,
  } satisfies SpringPreset as SpringPreset,
} as const;
