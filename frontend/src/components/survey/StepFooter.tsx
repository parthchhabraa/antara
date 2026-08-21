"use client";

import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

interface StepFooterProps {
  onPrimary: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  loading?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
}

// Sticky, thumb-reachable CTA row pinned to the bottom of the viewport so a
// respondent never has to scroll to advance — core to the one-question,
// full-screen-focus flow.
export const StepFooter: React.FC<StepFooterProps> = ({
  onPrimary,
  primaryLabel = "Continue",
  primaryDisabled = false,
  loading = false,
  onSkip,
  skipLabel = "Skip",
}) => {
  return (
    <div className="sticky bottom-0 px-5 pt-3 pb-[max(1.1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#05100B] via-[#05100B] to-transparent">
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled || loading}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-[#05100B] font-bold text-sm shadow-glow-emerald hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <span>{primaryLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
      {onSkip && !loading && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-xs font-medium text-gray-500 hover:text-gray-300 mt-3 py-1 transition-colors"
        >
          {skipLabel}
        </button>
      )}
    </div>
  );
};
