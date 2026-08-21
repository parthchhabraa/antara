"use client";

import React from "react";

interface StepContainerProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
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
    <div className="flex flex-col min-h-full px-5 pt-6 pb-4">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5">
          {icon}
        </div>
      )}
      {eyebrow && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-gold-400 mb-1.5">
          {eyebrow}
        </span>
      )}
      <h1 className="text-2xl font-black tracking-tight text-white leading-snug">{title}</h1>
      {subtitle && <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{subtitle}</p>}

      <div className="mt-6 flex-1">{children}</div>
    </div>
  );
};
