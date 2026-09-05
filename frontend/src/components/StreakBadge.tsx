"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { springs } from "@/lib/motion";

interface StreakBadgeProps {
  streak: number;
}

// Small flame + number, header-only — deliberately not inside BurnGauge, which
// stays focused on burn rate. Real accounts only (see MobileFrame's usage);
// renders nothing until there's an actual streak to show, so a brand-new
// account's header doesn't open with a discouraging "0".
//
// The other of the app's two core-habit-loop moments (see BurnGauge.tsx for
// the first) — a real streak increment is the other clearest reinforcer of
// the daily logging habit, so it gets `springs.snappy` too, not a plain
// number swap: the pill itself gives one spring "pop" and the digit
// cross-fades/scales in via AnimatePresence, both using the same shared
// snappy preset (lib/motion.ts) as BurnGauge — the two moments look and
// feel like one consistent animation language, not two different one-offs.
export const StreakBadge: React.FC<StreakBadgeProps> = ({ streak }) => {
  const prevStreak = useRef(streak);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    if (streak > prevStreak.current) {
      setPopped(true);
    }
    prevStreak.current = streak;
  }, [streak]);

  if (!streak || streak <= 0) return null;

  return (
    <motion.div
      title={`${streak}-day logging streak`}
      animate={{ scale: popped ? 1.2 : 1 }}
      transition={springs.snappy}
      onAnimationComplete={() => {
        if (popped) setPopped(false);
      }}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/25 font-bold shrink-0"
    >
      <Flame className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={streak}
          initial={{ scale: 0.4, opacity: 0, y: -6 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.4, opacity: 0, y: 6 }}
          transition={springs.snappy}
        >
          {streak}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
};
