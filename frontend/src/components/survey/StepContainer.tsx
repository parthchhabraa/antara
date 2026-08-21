"use client";

import React from "react";
import { motion } from "framer-motion";

interface StepContainerProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Pre-styled node (e.g. a colored category badge) — rendered as-is, no default box. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

// Shared layout for a single in-focus question/section. Keeps typography and
// spacing consistent across demographic, category-amount, and text steps.
export const StepContainer: React.FC<StepContainerProps> = ({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
}) => {
  return (
    <div className="flex-1 px-5 pt-5 pb-4">
      {icon && (
        <motion.div
          key={eyebrow /* re-pop when the category changes */}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="mb-4"
        >
          {icon}
        </motion.div>
      )}
      {eyebrow && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent-amber mb-1.5 block">
          {eyebrow}
        </span>
      )}
      <h1 className="text-xl font-black tracking-tight text-white leading-snug">{title}</h1>
      {subtitle && <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed">{subtitle}</p>}

      <div className="mt-5">{children}</div>
    </div>
  );
};
