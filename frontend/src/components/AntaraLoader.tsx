"use client";

import React from "react";
import { motion } from "framer-motion";
import { AntaraMark } from "./AntaraMark";

// Step 11 — full-screen loading state (app boot / auth check), Whoop-style:
// the mark held centered, a slow breathing pulse (scale + glow), on the
// app's existing near-black. This component has NO internal timer or fixed
// duration — it loops for exactly as long as it's mounted, and it's the
// caller's job (RootLayout below, gated on AuthContext's real `loading`
// boolean) to stop rendering it the instant the actual load finishes. It
// never fakes a duration decoupled from real load state.
export const AntaraLoader: React.FC = () => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#060709]">
    <motion.div
      animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.75, 1, 0.75] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      style={{ filter: "drop-shadow(0 0 22px rgba(62,124,153,0.35))" }}
    >
      <AntaraMark size={72} />
    </motion.div>
  </div>
);
