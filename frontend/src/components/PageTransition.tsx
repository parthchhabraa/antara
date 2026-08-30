"use client";

import React from "react";
import { motion } from "framer-motion";
import { springs } from "@/lib/motion";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// Next.js App Router unmounts the outgoing route before the incoming one
// mounts, so there's no overlap window for a true crossfade between pages.
//
// Restored real motion here after real feedback that flattening this to a
// near-instant fade (the animation brief's own "skip page-transition
// flourishes" reading) contributed to the whole app feeling unchanged —
// tab switches are one of the most frequent, visible interactions in the
// app, so a flat cut there undercut the "broader fluidity" goal even while
// the two core-loop moments and the shared spring config were genuinely
// working. Uses the same `springs.default` every sheet/chip/nav element
// now uses (see lib/motion.ts) — a tab switch reads as part of the same
// fluid language as everything else, not its own bespoke curve.
export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = "space-y-4" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.default}
      className={className}
    >
      {children}
    </motion.div>
  );
};
