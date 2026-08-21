"use client";

import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { AntaraLoader } from "./AntaraLoader";

// Step 11 — sits inside AuthProvider (layout.tsx) and is the thing that
// actually decides whether the loader shows: reads AuthContext's real
// `loading` boolean (true until onAuthStateChanged's first callback fires),
// which existed before this pass but nothing ever consumed — the app either
// blank-flashed or briefly showed the wrong screen (signed-out hero) while
// auth was still resolving. Nothing here has its own timer.
export const AppBootGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  if (loading) return <AntaraLoader />;
  return <>{children}</>;
};
