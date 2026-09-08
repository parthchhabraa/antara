"use client";

import React, { useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { IconTarget, IconLineChart } from "@/components/icons";
import { ArchetypeSheet } from "./ArchetypeSheet";
import { LearningCurveSheet } from "./LearningCurveSheet";
import { Transaction } from "@/types";

interface InsightsSectionProps {
  user: FirebaseUser | null;
  isDemoMode: boolean;
  transactions: Transaction[];
}

// Brief 9 (2026-09-06): moved off the Pull screen, per the brief ("Bury
// Instances, LearningCurveSheet and ArchetypeSheet behind profile. Don't
// delete.") — same two sheets, same props, as when they lived as two
// dotted-underline text links at the bottom of app/graph/page.tsx; only
// the entry point is new. A real, disclosed functionality loss for
// demo/guest accounts, same shape as Brief 7's Budget/Instances move:
// this section only renders for a real signed-in user (see
// app/profile/page.tsx), so a demo/guest visitor can no longer see either
// insight at all — they previously could, on Pull, in either mode.
export const InsightsSection: React.FC<InsightsSectionProps> = ({ user, isDemoMode, transactions }) => {
  const [isArchetypeOpen, setIsArchetypeOpen] = useState(false);
  const [isLearningCurveOpen, setIsLearningCurveOpen] = useState(false);

  return (
    <>
      <div className="text-xs font-medium tracking-[0.14em] text-gray-600 mt-6 mb-2">INSIGHTS</div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setIsArchetypeOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-sm bg-white/[0.04] text-sm text-gray-200"
        >
          <IconTarget className="w-4 h-4 text-gray-400" />
          Your spending archetype
        </button>

        <button
          type="button"
          onClick={() => setIsLearningCurveOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-sm bg-white/[0.04] text-sm text-gray-200"
        >
          <IconLineChart className="w-4 h-4 text-gray-400" />
          How well Antara knows you
        </button>
      </div>

      <ArchetypeSheet
        isOpen={isArchetypeOpen}
        onClose={() => setIsArchetypeOpen(false)}
        transactions={transactions}
        isDemoMode={isDemoMode}
        user={user}
      />
      <LearningCurveSheet
        isOpen={isLearningCurveOpen}
        onClose={() => setIsLearningCurveOpen(false)}
        transactions={transactions}
        isDemoMode={isDemoMode}
        user={user}
      />
    </>
  );
};
