"use client";

import React from "react";
import { motion } from "framer-motion";

// Brief branded loading state (cooldown check on mount) instead of a blank
// flash of background — mirrors the "A" mark used in the live app's header.
export const BrandedLoader: React.FC = () => (
  <div className="h-[100dvh] bg-background flex items-center justify-center">
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-glow-purple font-black text-sm tracking-wider text-white"
    >
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
        A
      </motion.span>
    </motion.div>
  </div>
);
