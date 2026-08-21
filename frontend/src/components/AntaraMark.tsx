"use client";

import React from "react";

interface AntaraMarkProps {
  size?: number;
  className?: string;
}

// The real Antara "A" mark — Step 11. Same geometry/colors as
// frontend/public/brand/logo-mark.svg (kept in sync manually — this inline
// version exists so header/loader usages can animate individual pieces with
// Framer Motion without fetching a separate SVG file). Black (#171717) +
// steel blue (#3E7C99), split down the center, with a genuinely transparent
// gap band (not painted white) so it reads correctly on both the app's dark
// theme and any light surface.
export const AntaraMark: React.FC<AntaraMarkProps> = ({ size = 32, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Antara" className={className}>
    <polygon points="100,15 53.59,104 100,104" fill="#171717" />
    <polygon points="43.16,124 15,178 100,178 100,124" fill="#171717" />
    <polygon points="100,15 100,104 146.41,104" fill="#3E7C99" />
    <polygon points="100,124 156.84,124 185,178 100,178" fill="#3E7C99" />
  </svg>
);
