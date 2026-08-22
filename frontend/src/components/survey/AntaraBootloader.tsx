"use client";

import React from "react";
import { AntaraMark } from "./AntaraMark";
import { AntaraWordmark } from "./AntaraWordmark";

// Full-screen splash shown while the survey boots — the mark's two halves
// converge and the gap closes (see AntaraMark), then the wordmark settles
// in underneath. Held on screen for a fixed minimum duration by the caller
// (page.tsx) so the animation always gets to play instead of flashing by
// whenever the cooldown check happens to resolve instantly.
export const AntaraBootloader: React.FC = () => (
  <div className="h-[100dvh] bg-background flex flex-col items-center justify-center gap-5">
    <AntaraMark size={104} animate />
    <AntaraWordmark />
  </div>
);
