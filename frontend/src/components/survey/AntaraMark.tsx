"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { BRAND_DARK, BRAND_BLUE } from "@/lib/brand";

interface AntaraMarkProps {
  size?: number;
  /** Play the assemble-in animation once on mount (Whoop-style geometry release). */
  animate?: boolean;
}

// The "A" mark, rebuilt as SVG geometry rather than an image so its two
// halves and the gap between them can actually move — reconstructed by eye
// off the logo screenshots (not the original vector file), see brand.ts.
//
// Shape: a triangle split down the centerline into a dark left half and a
// blue right half, with a horizontal band cut out a little below center —
// reads as the "A" and as an upward arrow at once. Built as two solid
// triangle-halves plus a background-colored gap rect, rather than a single
// notched path — easier to keep correct, and it animates more cleanly:
// the halves converge from outside, the gap rect closes from a wide open
// shutter to its resting band.
export const AntaraMark: React.FC<AntaraMarkProps> = ({ size = 96, animate = true }) => {
  const leftVariants: Variants = {
    hidden: { x: -26, rotate: -5, opacity: 0 },
    shown: {
      x: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 260, damping: 20, delay: 0.05 },
    },
  };
  const rightVariants: Variants = {
    hidden: { x: 26, rotate: 5, opacity: 0 },
    shown: {
      x: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 260, damping: 20, delay: 0.14 },
    },
  };
  const gapVariants: Variants = {
    hidden: { scaleY: 4.2, opacity: 0 },
    shown: {
      scaleY: 1,
      opacity: 1,
      transition: { type: "spring", stiffness: 220, damping: 22, delay: 0.32 },
    },
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Antara"
      style={{ filter: "drop-shadow(0 0 18px rgba(140,160,230,0.28))" }}
    >
      {/* The brand's dark half is true near-black, made for a light/white
          background. On this app's near-black UI that would nearly vanish,
          so it gets a faint edge stroke here for definition — the fill
          itself stays the real brand color. */}
      <motion.polygon
        points="100,15 15,178 100,178"
        fill={BRAND_DARK}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        initial={animate ? "hidden" : "shown"}
        animate="shown"
        variants={leftVariants}
        style={{ transformOrigin: "60px 130px" }}
      />
      <motion.polygon
        points="100,15 185,178 100,178"
        fill={BRAND_BLUE}
        initial={animate ? "hidden" : "shown"}
        animate="shown"
        variants={rightVariants}
        style={{ transformOrigin: "140px 130px" }}
      />
      {/* Gap band — same color as whatever sits behind the mark. Pass a
          matching background via the wrapping element; defaults to the
          app's near-black background. */}
      <motion.rect
        x={-10}
        y={104}
        width={220}
        height={20}
        className="fill-background"
        initial={animate ? "hidden" : "shown"}
        animate="shown"
        variants={gapVariants}
        style={{ transformOrigin: "100px 114px" }}
      />
    </svg>
  );
};
