"use client";

import React from "react";
import { motion } from "framer-motion";

// Text-based reconstruction of the "ANTARA / MONEY" lockup — approximated
// with a generic serif stack since the actual brand typeface file wasn't
// available to embed. Swap `font-family` below for the real one if you can
// share its name/file.
export const AntaraWordmark: React.FC<{ delay?: number }> = ({ delay = 0.5 }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className="text-center"
  >
    <div
      className="text-2xl font-bold tracking-wide text-white"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      ANTARA
    </div>
    <div className="text-xs font-medium tracking-[0.4em] text-gray-400 mt-0.5">MONEY</div>
  </motion.div>
);
