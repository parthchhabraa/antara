"use client";

import React from "react";
import { motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// Next.js App Router unmounts the outgoing route before the incoming one
// mounts, so there's no overlap window for a true crossfade between pages.
// This gives each page a consistent "arrive" motion (fade + slide up) so
// switching tabs reads as a transition rather than a hard cut.
export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = "space-y-4" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
