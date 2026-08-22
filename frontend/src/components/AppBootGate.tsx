"use client";

import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { AntaraLoader } from "./AntaraLoader";
import { ConsentGate } from "./ConsentGate";
import { BudgetSheet } from "./BudgetSheet";

// Step 11 — sits inside AuthProvider (layout.tsx) and is the thing that
// actually decides whether the loader shows: reads AuthContext's real
// `loading` boolean (true until onAuthStateChanged's first callback fires),
// which existed before this pass but nothing ever consumed — the app either
// blank-flashed or briefly showed the wrong screen (signed-out hero) while
// auth was still resolving. Nothing here has its own timer.
//
// Step 12: also gates on `pendingConsent` — a brand-new real sign-in sits
// here, not in the app, until they confirm ConsentGate's checkbox. Checked
// after `loading` so the boot loader still gets priority on first paint.
//
// Step 13: then gates on `pendingBudgetSetup` — right after consent, before
// the first Today screen, per the brief's explicit ordering. Checked after
// pendingConsent since consent must resolve first (declining signs back out
// to Demo Mode, which never needs a budget).
export const AppBootGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, pendingConsent, pendingBudgetSetup, setMonthlyBudget } = useAuth();
  if (loading) return <AntaraLoader />;
  if (pendingConsent) return <ConsentGate />;
  if (pendingBudgetSetup) return <BudgetSheet isOpen mode="onboarding" onSave={setMonthlyBudget} />;
  return <>{children}</>;
};
