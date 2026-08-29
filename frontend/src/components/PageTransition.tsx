"use client";

import React from "react";
import { motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// Next.js App Router unmounts the outgoing route before the incoming one
// mounts, so there's no overlap window for a true crossfade between pages.
//
// Simplified as part of the animation-craft pass (see lib/motion.ts):
// route-level page transitions are explicitly on that brief's "skip" list —
// a tab switch shouldn't get its own bespoke motion, just enough to avoid
// reading as a hard cut. Down from a 0.35s fade+14px-slide-up on a custom
// cubic-bezier to a near-instant 0.12s opacity-only fade on the platform
// default ease.
export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = "space-y-4" }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
