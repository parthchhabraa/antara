// Step 16 — was an "eyeballed approximation" (`#171717`/`#3E7C99`) sampled
// off logo screenshots before the real source file was available. Step
// 11/12 on `main` (frontend/src/components/AntaraMark.tsx) later traced the
// real `logoAntara.png` directly via potrace and confirmed the real values:
// `#0E87B0` blue, not `#3E7C99` — a 34.7% pixel-diff, not just anti-aliasing
// noise — and `#1F1E1C` dark, not `#171717`. Porting this branch's survey
// app into `main` without picking up that correction would silently
// reintroduce a color mismatch `main` already found and fixed elsewhere;
// updated to the same real values here instead. The survey's own
// AntaraMark.tsx keeps its own animated SVG construction (a different
// build from the static traced path used in the main app's header/loader —
// it needs to animate the two halves apart on mount) rather than being
// re-traced to match that path's exact geometry too; that's a real,
// separate follow-up (matching Step 12's potrace work for this animated
// version) rather than something to redo blind as part of this port.
export const BRAND_DARK = "#1F1E1C";
export const BRAND_BLUE = "#0E87B0";
