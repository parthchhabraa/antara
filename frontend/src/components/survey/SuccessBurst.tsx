"use client";

import React from "react";
import { motion } from "framer-motion";
import { springs } from "@/lib/motion";

const DOT_COLORS = ["#A78BFA", "#8B5CF6", "#DDD6FE"];

// A small, tasteful radial burst of dots behind the thank-you checkmark —
// a functional celebration moment (submission succeeded), not decorative
// filler, and no emoji involved.
//
// Toned down as part of the animation-craft pass (see lib/motion.ts): this
// is a one-time onboarding-completion moment, not one of the app's two
// core-habit-loop moments, so it doesn't get its own bespoke easing curve —
// down from 6 dots/0.7s/custom-ease to 3 dots/shorter travel, riding the
// same shared `springs.default` every other generic transition uses,
// rather than removed outright (it still earns a small acknowledgment at a
// genuinely successful moment, just a cheaper one).
export const SuccessBurst: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {DOT_COLORS.map((color, i) => {
        const angle = (i / DOT_COLORS.length) * 2 * Math.PI;
        const distance = 32;
        return (
          <motion.span
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: [0, 1, 0],
              scale: 1,
            }}
            transition={{
              // Framer Motion doesn't support spring physics for a
              // keyframe-array target (opacity here goes 0→1→0), so that
              // one property keeps a plain, cheap tween while the actual
              // travel (x/y/scale) gets the real springs.default pop.
              x: { ...springs.default, delay: 0.1 + i * 0.02 },
              y: { ...springs.default, delay: 0.1 + i * 0.02 },
              scale: { ...springs.default, delay: 0.1 + i * 0.02 },
              opacity: { duration: 0.45, delay: 0.1 + i * 0.02, ease: "easeOut" },
            }}
          />
        );
      })}
    </div>
  );
};
