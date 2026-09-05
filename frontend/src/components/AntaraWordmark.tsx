"use client";

import React from "react";
import { AntaraMark } from "./AntaraMark";

interface AntaraWordmarkProps {
  markSize?: number;
  className?: string;
}

// Full "ANTARA MONEY" lockup for the sign-in hero — Step 11. Built as live
// SVG + text rather than a rasterized export of the provided logo-full.jpg:
// this repo's environment doesn't have direct file-system access to the
// exact bytes of images pasted into chat, but survey.antara.money (the same
// user's sibling project) already ships the identical typographic recipe on
// its own boot screen — Georgia/Times New Roman serif, bold "ANTARA",
// smaller wide-tracked "MONEY" beneath — so this reconstructs that exact,
// already-validated treatment instead of guessing at one. Rendering as text
// also sidesteps the "JPG has a white background" problem entirely (see
// REVIEW.md item 1) — there's no raster background to fight with the dark
// theme. "ANTARA" renders in white/light text (not the mark's black) since
// black text would simply vanish on this dark hero — the mark alone carries
// the brand's black/steel-blue palette; see REVIEW.md item 2 for the fuller
// color decision this is downstream of.
export const AntaraWordmark: React.FC<AntaraWordmarkProps> = ({ markSize = 40, className = "" }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <AntaraMark size={markSize} />
    <div>
      <div
        className="text-2xl font-bold tracking-wide text-white leading-none"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        ANTARA
      </div>
      <div className="text-xs font-medium tracking-[0.35em] text-gray-400 mt-1">MONEY</div>
    </div>
  </div>
);
