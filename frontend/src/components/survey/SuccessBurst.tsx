"use client";

import React from "react";
import { motion } from "framer-motion";

const DOT_COLORS = ["#A78BFA", "#8B5CF6", "#C4B5FD", "#7C3AED", "#DDD6FE", "#9D8FEF"];

// A small, tasteful radial burst of dots behind the thank-you checkmark —
// a functional celebration moment (submission succeeded), not decorative
// filler, and no emoji involved.
export const SuccessBurst: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {DOT_COLORS.map((color, i) => {
        const angle = (i / DOT_COLORS.length) * 2 * Math.PI;
        const distance = 46;
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
            transition={{ duration: 0.7, delay: 0.15 + i * 0.02, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
};
