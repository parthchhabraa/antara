"use client";

import React from "react";
import { Flame } from "lucide-react";

interface StreakBadgeProps {
  streak: number;
}

// Small flame + number, header-only — deliberately not inside BurnGauge, which
// stays focused on burn rate. Real accounts only (see MobileFrame's usage);
// renders nothing until there's an actual streak to show, so a brand-new
// account's header doesn't open with a discouraging "0".
export const StreakBadge: React.FC<StreakBadgeProps> = ({ streak }) => {
  if (!streak || streak <= 0) return null;

  return (
    <div
      title={`${streak}-day logging streak`}
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/25 font-bold shrink-0"
    >
      <Flame className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
      <span>{streak}</span>
    </div>
  );
};
