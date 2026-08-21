"use client";

import React, { useEffect, useState } from "react";
import { animate } from "framer-motion";

interface CountUpNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

// Animates a numeric value counting up from 0 (or its previous value) to the
// target whenever `value` changes, instead of snapping straight to the final
// number. Used for the prediction card's headline stats.
export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 1.1,
  className,
}) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
};
