"use client";

import React from "react";

interface AntaraMarkProps {
  size?: number;
  className?: string;
}

// The real Antara "A" mark — Step 11, corrected after the actual source file
// turned up on origin/main (commit e8f43f6, "logos upload") mid-review. The
// first version of this component was a hand-measured SVG reconstruction
// (traced from survey.antara.money's own approximation of the mark) —
// close, but its blue was #3E7C99 against the real file's #0E87B0, and the
// leg geometry wasn't quite right either. Once the real `logoAntara.png`
// was available (confirmed via ImageMagick: real alpha transparency, gap
// band genuinely transparent not painted white — srgba(0,0,0,0) sampled
// directly), rendering it directly is both simpler and exactly correct,
// so this now points at the actual asset instead of approximating it.
export const AntaraMark: React.FC<AntaraMarkProps> = ({ size = 32, className = "" }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/brand/logo-mark-1024.png"
    alt="Antara"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: "contain" }}
  />
);
