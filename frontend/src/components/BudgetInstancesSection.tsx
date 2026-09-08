"use client";

import React, { useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { IconSliders } from "@/components/icons";
import { BudgetSheet } from "./BudgetSheet";
import { InstancesSheet } from "./InstancesSheet";
import { FORMAT_INR } from "@/lib/constants";
import { Transaction } from "@/types";

interface BudgetInstancesSectionProps {
  user: FirebaseUser | null;
  isDemoMode: boolean;
  monthlyBudget: number;
  transactions: Transaction[];
  activeInstanceId?: string;
  onSaveBudget: (amount: number) => Promise<void>;
  onApplyInstance: (instanceId: string, allocation: Record<string, number>) => Promise<void>;
}

// Brief 7 (2026-09-05): moved off the Today screen entirely, per the
// brief ("The Instances and budget links move off this screen entirely,
// into profile") — Today now answers exactly one question, and neither
// of these is it. Same two sheets (BudgetSheet/InstancesSheet), same
// props, same behavior as when they lived on page.tsx; only the entry
// point and the transactions this section subscribes to for the
// Instances preview are new (see app/profile/page.tsx's own live
// subscription, mirroring page.tsx's demo/live pattern).
export const BudgetInstancesSection: React.FC<BudgetInstancesSectionProps> = ({
  user,
  isDemoMode,
  monthlyBudget,
  transactions,
  activeInstanceId,
  onSaveBudget,
  onApplyInstance,
}) => {
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isInstancesOpen, setIsInstancesOpen] = useState(false);

  return (
    <>
      <div className="text-xs font-medium tracking-[0.14em] text-gray-600 mt-6 mb-2">BUDGET</div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setIsBudgetOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-sm bg-white/[0.04] text-sm text-gray-200"
        >
          <IconSliders className="w-4 h-4 text-gray-400" />
          <span>Monthly budget</span>
          <span className="ml-auto font-mono tabular-nums text-gray-400">{FORMAT_INR(monthlyBudget)}/mo</span>
        </button>

        <button
          type="button"
          onClick={() => setIsInstancesOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-sm bg-white/[0.04] text-sm text-gray-200"
        >
          <IconSliders className="w-4 h-4 text-gray-400" />
          Instances
        </button>
      </div>

      <BudgetSheet
        isOpen={isBudgetOpen}
        mode="edit"
        currentAmount={monthlyBudget}
        onClose={() => setIsBudgetOpen(false)}
        onSave={async (amount) => {
          await onSaveBudget(amount);
          setIsBudgetOpen(false);
        }}
      />
      <InstancesSheet
        isOpen={isInstancesOpen}
        onClose={() => setIsInstancesOpen(false)}
        transactions={transactions}
        monthlyBudget={monthlyBudget}
        isDemoMode={isDemoMode}
        user={user}
        activeInstanceId={activeInstanceId}
        onApply={onApplyInstance}
      />
    </>
  );
};
