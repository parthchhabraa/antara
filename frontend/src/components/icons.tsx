"use client";

import React from "react";

/**
 * Antara's custom icon set (Brief 9, 2026-09-06) — replaces lucide-react
 * entirely. Every glyph below is hand-drawn on the same 24x24 grid with the
 * same stroke weight, so the set reads as one system rather than borrowed
 * parts (see lib/design.ts's new "Icons" section for the grid/stroke rule
 * this file exists to satisfy).
 *
 * `import * as LucideIcons from "lucide-react"` in the old CategoryIcon.tsx
 * resolved a category's icon name to a component at *render time* from a
 * dynamic string key — webpack can't tree-shake a namespace object accessed
 * that way, so the whole package (thousands of icons) shipped in the bundle
 * for the ~68 actually used across the app. This file only ever exports the
 * icons Antara actually uses — nothing dynamic, nothing unused to ship.
 *
 * API: every icon is `<IconName size={20} className="..." strokeWidth={1.75} />`.
 * `strokeWidth` defaults to 1.75 (Lucide's own default is 2; Antara's is
 * very slightly lighter to match Plex's own text weight better at small
 * sizes) — pass an explicit value only where a component genuinely needs a
 * heavier or lighter line (the four nav glyphs use 1.6, matching the weight
 * MobileFrame already tuned by eye before this pass).
 */

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  // Optional solid fill (e.g. "currentColor") for the rare glyph shown
  // filled rather than outlined — StreakBadge/ProfileView's active-streak
  // flame, specifically. Defaults to unfilled, same as every other icon.
  fill?: string;
}

type IconFC = React.FC<IconProps>;

// Every icon shares this wrapper so viewBox/stroke/cap/join conventions
// can't drift between glyphs — pass only the inner path/shape markup.
const svg = (
  strokeWidth: number | undefined,
  size: number | undefined,
  className: string | undefined,
  children: React.ReactNode,
  fill?: string
) => (
  <svg
    width={size ?? 24}
    height={size ?? 24}
    viewBox="0 0 24 24"
    fill={fill ?? "none"}
    stroke="currentColor"
    strokeWidth={strokeWidth ?? 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

// ── Nav (4 glyphs — Today / Pull / Ask / Log) ──────────────────────────

export const IconToday: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.75" fill="currentColor" stroke="none" />
    </>
  ));

export const IconPull: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(30 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ));

export const IconAsk: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z" />
      <circle cx="9" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
    </>
  ));

export const IconPlus: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M12 5v14M5 12h14" />);

// ── General UI ──────────────────────────────────────────────────────────

export const IconAlertTriangle: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17.25" r="0.9" fill="currentColor" stroke="none" />
    </>
  ));

export const IconArchive: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
      <path d="M5 9v9.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 13.5h4" />
    </>
  ));

export const IconArrowLeft: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M19 12H5M11 6l-6 6 6 6" />);

export const IconArrowRight: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M5 12h14M13 6l6 6-6 6" />);

export const IconCheck: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />);

export const IconCheckCircle: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.3 11 15.3 16.3 9" />
    </>
  ));

export const IconChevronLeft: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M14.5 5.5 8 12l6.5 6.5" />);

export const IconChevronRight: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M9.5 5.5 16 12l-6.5 6.5" />);

export const IconCopy: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M15 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v7.5A1.5 1.5 0 0 0 6 15h2.5" />
    </>
  ));

export const IconDatabase: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
      <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
    </>
  ));

export const IconDelete: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M8 5.5h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-6-6.5z" />
      <path d="M11 10l5 5M16 10l-5 5" />
    </>
  ));

export const IconDownload: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M12 4v11.5M7.5 11l4.5 4.5 4.5-4.5" />
      <path d="M4.5 18.5h15" />
    </>
  ));

// Closed silhouette (not an open stroke line) — every real usage renders
// this filled (fill="currentColor" strokeWidth={0}, StreakBadge/ProfileView's
// active-streak flame), and an open path collapses to a sliver once
// stroked width goes to 0 with no outline left to carry its shape.
export const IconFlame: IconFC = ({ size, className, strokeWidth, fill }) =>
  svg(
    strokeWidth,
    size,
    className,
    <path d="M12 2.3c-1.9 2.7-6.1 7.2-6.1 11.4a6.1 6.1 0 0 0 12.2 0c0-2-.9-3.7-1.9-5.1.2 1.7-.7 2.8-1.7 3.1.8-3.4-.7-6.7-2.5-9.4Z" />,
    fill
  );

export const IconGlobe: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z" />
    </>
  ));

export const IconHelpCircle: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.3 9.5a2.7 2.7 0 1 1 3.9 2.4c-.8.5-1.2 1-1.2 1.9" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ));

export const IconLineChart: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4 4v16.5h16.5" />
      <path d="M6.5 15.5 10.5 11l3 2.5 5-6" />
    </>
  ));

export const IconLoader: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />);

export const IconLogOut: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M10 20H5.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H10" />
      <path d="M15.5 16.5 20 12l-4.5-4.5M20 12H9" />
    </>
  ));

export const IconMessageSquare: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z" />);

export const IconMessageSquareText: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z" />
      <path d="M7.5 9h9M7.5 12.5h6" />
    </>
  ));

export const IconMic: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v2.5M9 20.5h6" />
    </>
  ));

export const IconNfc: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M6 6a11 11 0 0 1 0 12" />
      <path d="M10 8.5a7 7 0 0 1 0 7" />
      <path d="M14 10.5a3.6 3.6 0 0 1 0 3" />
      <circle cx="18.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ));

export const IconPencil: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M15.2 4.8 19.2 8.8 8 20H4v-4Z" />
      <path d="M13.2 6.8 17.2 10.8" />
    </>
  ));

export const IconPin: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ));

export const IconQrCode: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="0.75" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="0.75" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="0.75" />
      <path d="M14.5 15h2.5v2.5h-2.5zM19 15h1.5v1.5H19zM14.5 19h1.5v1.5h-1.5zM19 19h1.5v1.5H19z" fill="currentColor" stroke="none" />
    </>
  ));

export const IconRadio: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.5 5.5a9.5 9.5 0 0 0 0 13M18.5 5.5a9.5 9.5 0 0 1 0 13" />
    </>
  ));

export const IconRefresh: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6M4.5 12a7.5 7.5 0 0 1 13.4-4.6" />
      <path d="M6.1 16.6 4.5 16.6 4.5 18.2M17.9 7.4l1.6 0 0-1.6" />
    </>
  ));

export const IconScanLine: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4.5 8V6a1.5 1.5 0 0 1 1.5-1.5h2M4.5 16v2A1.5 1.5 0 0 0 6 19.5h2" />
      <path d="M19.5 8V6A1.5 1.5 0 0 0 18 4.5h-2M19.5 16v2a1.5 1.5 0 0 1-1.5 1.5h-2" />
      <path d="M4.5 12h15" />
    </>
  ));

export const IconSend: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M4.5 11.5 20 4l-6.8 16-2.9-7.3-7.3-2.9Z" />);

export const IconServer: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="3.5" y="4" width="17" height="6" rx="1.3" />
      <rect x="3.5" y="14" width="17" height="6" rx="1.3" />
      <path d="M7 7h.01M7 17h.01" strokeWidth={2.5} />
    </>
  ));

export const IconShield: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M12 3.5 19 6.5v5c0 5-3 8-7 9-4-1-7-4-7-9v-5Z" />);

export const IconShieldAlert: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M12 3.5 19 6.5v5c0 5-3 8-7 9-4-1-7-4-7-9v-5Z" />
      <path d="M12 8.5v4.2" />
      <circle cx="12" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ));

export const IconShieldCheck: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M12 3.5 19 6.5v5c0 5-3 8-7 9-4-1-7-4-7-9v-5Z" />
      <path d="M9 12.2 11.2 14.4 15.3 9.8" />
    </>
  ));

export const IconSliders: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4.5 6.5h6M14 6.5h5.5M4.5 12h9M17 12h2.5M4.5 17.5h4M12.5 17.5h7" />
      <circle cx="12" cy="6.5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="17.5" r="1.9" fill="currentColor" stroke="none" />
    </>
  ));

// Replaces the old "Sparkles" AI-suggestion glyph — Brief 6's house rules
// ban sparkle icons outright, and "tap to switch" is a swap action anyway,
// which this reads as more literally than a sparkle ever did.
export const IconSuggest: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4.5 8.5h12.5M14 5l3 3.5-3 3.5" />
      <path d="M19.5 15.5H7M10 12l-3 3.5 3 3.5" />
    </>
  ));

export const IconBell: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ));

export const IconTarget: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ));

export const IconThumbsDown: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <path d="M7 14V4.5h9l3 2v7.5l-4.5 6a1.8 1.8 0 0 1-3.3-1V15H5.5A1.5 1.5 0 0 1 4 13.2l1.3-6.7A1.5 1.5 0 0 1 6.8 5.2" />
  ));

export const IconThumbsUp: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <path d="M17 10v9.5H8l-3-2v-7.5l4.5-6a1.8 1.8 0 0 1 3.3 1V9h4.7a1.5 1.5 0 0 1 1.5 1.8l-1.3 6.7a1.5 1.5 0 0 1-1.5 1.2" />
  ));

export const IconTrash: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ));

export const IconUserCheck: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h3a4.5 4.5 0 0 1 4.5 4.5V20" />
      <path d="M16 12.5 18 14.5 21.5 10.5" />
    </>
  ));

export const IconUserCircle: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="3" />
      <path d="M5.8 18.2a6.5 6.5 0 0 1 12.4 0" />
    </>
  ));

export const IconUserMinus: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h3a4.5 4.5 0 0 1 4.5 4.5V20" />
      <path d="M16.5 12.5h5" />
    </>
  ));

export const IconUserPlus: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h3a4.5 4.5 0 0 1 4.5 4.5V20" />
      <path d="M19 10v5M16.5 12.5h5" />
    </>
  ));

export const IconUsers: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <circle cx="8.5" cy="8" r="3.2" />
      <path d="M3 19.5v-1.2A4 4 0 0 1 7 14.3h3a4 4 0 0 1 4 4v1.2" />
      <path d="M15 8.3a3 3 0 1 1 3.2 5" />
      <path d="M17.5 14.5a4 4 0 0 1 3.5 4v1" />
    </>
  ));

export const IconWallet: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h12A1.5 1.5 0 0 1 19 7.5V9H5.5A1.5 1.5 0 0 1 4 7.5Z" />
      <path d="M4 7.5v10A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18.5 9H4" />
      <circle cx="15.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ));

export const IconX: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, <path d="M6 6l12 12M18 6L6 18" />);

// ── Category icons (18 — one per taxonomy entry in lib/constants.ts) ────
// Keys match the taxonomy's `icon` field one-to-one (see CategoryIcon.tsx).

export const IconUtensils: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M7 3.5v7a2 2 0 0 0 4 0v-7M9 3.5v17" />
      <path d="M16 3.5v6a2.5 2.5 0 0 0 2 2.4V20.5M16 3.5v6" />
    </>
  ));

export const IconHeart: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <path d="M12 20.2s-7.5-4.6-9.7-9.3C1 7.6 2.6 4.5 5.9 4c2.1-.3 3.9.8 6.1 3.2C14.2 4.8 16 3.7 18.1 4c3.3.5 4.9 3.6 3.6 6.9-2.2 4.7-9.7 9.3-9.7 9.3Z" />
  ));

export const IconShoppingBag: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M5.5 8h13l1 12.5h-15z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ));

export const IconCoins: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <ellipse cx="9" cy="8" rx="5.5" ry="3" />
      <path d="M3.5 8v3.5c0 1.66 2.46 3 5.5 3s5.5-1.34 5.5-3V8" />
      <ellipse cx="15" cy="14.5" rx="5.5" ry="3" />
      <path d="M9.5 14.5V18c0 1.66 2.46 3 5.5 3s5.5-1.34 5.5-3v-3.5" />
    </>
  ));

export const IconDumbbell: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M2.5 12h19" />
      <rect x="4" y="9" width="3" height="6" rx="1" />
      <rect x="17" y="9" width="3" height="6" rx="1" />
      <rect x="7.5" y="10.3" width="9" height="3.4" rx="0.6" />
    </>
  ));

export const IconCar: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4 16v-3.5l2-5A2 2 0 0 1 7.8 6.2h8.4a2 2 0 0 1 1.8 1.3l2 5V16" />
      <path d="M4 16v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2M20 16v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-2" />
      <path d="M4 16h16" />
      <circle cx="7.5" cy="16" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="16" r="1.1" fill="currentColor" stroke="none" />
    </>
  ));

export const IconDroplet: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <path d="M12 3.5c3 4 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-7 6-11Z" />
  ));

export const IconFilm: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.3" />
      <path d="M8 4.5v15M16 4.5v15M3.5 9h4.5M16 9h4.5M3.5 15h4.5M16 15h4.5" />
    </>
  ));

export const IconClapperboard: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4 9.5 5 5.5l13 3-1 4z" />
      <path d="M7 6.3l2.5 2.6M12 7.4l2.5 2.6" />
      <rect x="4" y="9.5" width="16" height="9.5" rx="1" />
    </>
  ));

export const IconLaptop: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="5" y="5" width="14" height="9.5" rx="1" />
      <path d="M2.5 18.5h19l-1.5-2.5H4z" />
    </>
  ));

export const IconGamepad: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M6.5 8h11a3.5 3.5 0 0 1 3.4 4.3l-.8 3.5a2.3 2.3 0 0 1-4.1.8L15 15H9l-1 1.6a2.3 2.3 0 0 1-4.1-.8l-.8-3.5A3.5 3.5 0 0 1 6.5 8Z" />
      <path d="M7.5 10.5v3M6 12h3" />
      <circle cx="15.5" cy="10.8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="12.8" r="0.8" fill="currentColor" stroke="none" />
    </>
  ));

export const IconPiggyBank: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M4.5 12a6 6 0 0 1 6-6h3a5.5 5.5 0 0 1 5 3.2l2-.5-.5 2.5-1.5 1v2.3a1 1 0 0 1-1 1H16l-1 2.5h-3l-.5-2H8.5l-1 2H4.5l1-3A6 6 0 0 1 4.5 12Z" />
      <circle cx="14.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M8 6.5V4.5M11 6V4.2" />
    </>
  ));

export const IconHeartHands: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M12 8.5s-1.6-2.2-3.8-2c-1.9.1-3.2 1.8-2.6 3.7C6.4 12.7 12 16 12 16s5.6-3.3 6.4-5.8c.6-1.9-.7-3.6-2.6-3.7-2.2-.2-3.8 2-3.8 2Z" />
      <path d="M4.5 19.5c1.5-1.7 3-2.3 4.5-1.7l3 1.2c1 .4 2 .1 2.6-.7l2.4-3" />
      <path d="M14.5 15l2.3-1c.9-.4 1.9 0 2.2.9.3.9-.2 1.8-1.1 2.1L14 19" />
    </>
  ));

export const IconPhone: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10.5 18.5h3" />
    </>
  ));

export const IconBook: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <path d="M4.5 5.5A2 2 0 0 1 6.5 4H12v16H6.5a2 2 0 0 0-2 2ZM12 4h5.5a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H12Z" />
  ));

export const IconDice: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8.3" cy="8.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="8.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.3" cy="15.7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="15.7" r="1" fill="currentColor" stroke="none" />
    </>
  ));

export const IconTrendingUp: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M3.5 16.5 9.5 10.5 13.5 14.5 20.5 6.5" />
      <path d="M15 6.5h5.5V12" />
    </>
  ));

export const IconGraduationCap: IconFC = ({ size, className, strokeWidth }) =>
  svg(strokeWidth, size, className, (
    <>
      <path d="M2.5 8 12 4l9.5 4-9.5 4-9.5-4Z" />
      <path d="M6.5 10v4.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V10" />
      <path d="M21.5 8v6" />
    </>
  ));
