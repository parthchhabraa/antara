"use client";

import React from "react";
import { motion } from "framer-motion";
import { CountUpNumber } from "./CountUpNumber";
import { springs } from "@/lib/motion";

interface BurnGaugeProps {
  burnPct: number; // 0-200+, 100 = exactly a safe day's pace
  size?: number;
  strokeWidth?: number;
}

// Whoop-style "burn rate vs. a safe day" ring — Antara's "focus score"
// equivalent, the at-a-glance number the daily log→see-burn-rate habit loop
// is built around. One of exactly two moments in the app that get real,
// bespoke animation craft (`springs.snappy`, see lib/motion.ts) rather than
// the shared default every other transition uses — both the ring fill and
// the center count-up (CountUpNumber, passed `spring={springs.snappy}`
// below) now animate with real spring physics, and genuinely re-animate
// from whatever's currently on screen on a live value change (e.g. right
// after logging a transaction), not just on first mount.
//
// Fill is capped visually at
// 100% of the ring's sweep (burnPct itself can exceed 100 and is shown as-is
// in the center number). Always renders in the violet brand gradient,
// matching the reference design exactly — the ring used to swap to a
// rose/amber "hot" gradient above 100%, but that's not in the actual
// reference (checked side-by-side at an identical 178%/over-pace state: the
// reference stays violet). Urgency at a high burn rate is still communicated
// by the number itself and the "Money runs out" card below, just not by a
// second, off-brand color system on the ring.
export const BurnGauge: React.FC<BurnGaugeProps> = ({ burnPct, size = 250, strokeWidth = 10 }) => {
  const clamped = Math.min(100, Math.max(0, burnPct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(147,151,171,0.13)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius * 0.885}
          fill="none"
          stroke="rgba(167,139,250,0.14)"
          strokeWidth={1}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#burnGaugeCool)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (clamped / 100) * circumference }}
          transition={{ ...springs.snappy, delay: 0.15 }}
          style={{ filter: "drop-shadow(0 0 12px rgba(139,92,246,0.5))" }}
        />
        <defs>
          <linearGradient id="burnGaugeCool" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="55%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium tracking-[0.16em] text-primary-300">BURN RATE</span>
        <span className="mt-1.5 text-[52px] font-medium leading-none tracking-tight text-white">
          <CountUpNumber value={burnPct} format={(n) => Math.round(n).toString()} spring={springs.snappy} />
          <span className="text-3xl">%</span>
        </span>
        <span className="mt-1 text-xs text-gray-500">of a safe day</span>
      </div>
    </div>
  );
};
