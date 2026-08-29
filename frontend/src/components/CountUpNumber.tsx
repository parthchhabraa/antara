"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import type { SpringPreset } from "@/lib/motion";

interface CountUpNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  // Opt into a real spring instead of the plain duration/ease tween below —
  // see lib/motion.ts. Reserved for BurnGauge's own count-up (one of the
  // app's two core-habit-loop moments); every other use of this component
  // stays on the plain default, per that file's own "don't spread it thin"
  // rule.
  spring?: SpringPreset;
}

// Animates a numeric value counting up to the target whenever `value`
// changes, instead of snapping straight to the final number. Used for the
// prediction card's headline stats.
//
// Animates FROM the value currently on screen, not always from 0 — a real
// bug found while giving BurnGauge's count-up real animation craft: the
// previous version called `animate(0, value, ...)` unconditionally, so a
// live value change (e.g. right after logging a transaction) looked like
// the counter restarting from zero rather than a smooth update from what
// was already showing. Fixed for every user of this component, not just
// BurnGauge, since it was a correctness bug, not a per-moment craft choice.
export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 1.1,
  className,
  spring,
}) => {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const controls = animate(displayRef.current, value, {
      ...(spring ?? { duration, ease: [0.16, 1, 0.3, 1] }),
      onUpdate: (latest) => {
        displayRef.current = latest;
        setDisplay(latest);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, spring]);

  return <span className={className}>{format(display)}</span>;
};
