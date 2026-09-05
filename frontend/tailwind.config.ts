import type { Config } from "tailwindcss";

// Brief 6 (2026-09-05) — design-system foundation. This file's job from
// here on is enforcing the tokens documented in src/lib/design.ts, not
// deciding them — read that file first if you're wondering *why* a value
// below is what it is. Two theme sections below deliberately REPLACE
// Tailwind's defaults (fontSize, borderRadius) rather than `extend`-ing
// them: extending would leave the old 8-step font scale and 5-step radius
// scale still generating classes alongside the new ones, so every
// pre-existing `text-xl`/`rounded-3xl` in the codebase would keep working
// at its *old* size — defeating the entire point of a real 6-step type
// scale and a real 2-step radius scale. Replacing them means every
// existing named-scale usage in the app was automatically remapped onto
// the new values the moment this file changed, not just newly-written code.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Exactly six steps, per the brief: 13 / 15 / 18 / 24 / 40 / 64.
    // Tailwind's eight default names (xs/sm/base/lg/xl/2xl/3xl/4xl) collapse
    // onto those six with intentional duplication (base==lg, xl==2xl,
    // 3xl==4xl) rather than inventing new class names — every existing
    // `text-xs`…`text-4xl` in the app keeps compiling, just at a new value.
    // `5xl` is defined for safety (nothing uses it today) at the top step.
    fontSize: {
      xs: ["13px", { lineHeight: "1.4" }],
      sm: ["15px", { lineHeight: "1.4" }],
      base: ["18px", { lineHeight: "1.45" }],
      lg: ["18px", { lineHeight: "1.3" }],
      xl: ["24px", { lineHeight: "1.25" }],
      "2xl": ["24px", { lineHeight: "1.2" }],
      "3xl": ["40px", { lineHeight: "1.15" }],
      "4xl": ["40px", { lineHeight: "1.1" }],
      "5xl": ["64px", { lineHeight: "1.05" }],
    },
    // Two steps, per the brief, plus `full` (a shape keyword — pills,
    // avatars, dots — not really a "radius step" in the sense the brief
    // means). `none`/`DEFAULT` kept at 0 since nothing in the app uses
    // bare `rounded`, but removing it entirely isn't worth the risk of a
    // silent no-op class if something does someday.
    borderRadius: {
      none: "0px",
      DEFAULT: "0px",
      sm: "12px",
      lg: "20px",
      full: "9999px",
    },
    extend: {
      colors: {
        background: "#08090C",
        card: "rgba(18, 20, 29, 0.75)",
        "card-border": "rgba(255, 255, 255, 0.08)",
        // Brand — violet/indigo, matching the original "Antara.dc.html"
        // ("1a — Strain") Claude Design mockup (Step 7 reverted an
        // emerald/gold reskin back to this). Brief 6: this ramp's job is
        // brand + interactive/selected chrome ONLY from here on — state
        // (under/watch/over, below) is a separate, non-overlapping ramp.
        // Existing call sites weren't re-plumbed in this brief (tokens
        // only, no restructuring — see REVIEW.md); `signal.*` exists now
        // so Briefs 7-9 have it ready when a screen's state-coloring
        // actually gets rebuilt, rather than each one re-inventing it.
        primary: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
          950: "#2E1065",
        },
        // Brief 6: three signal colors for under/watch/over — saturated
        // and flat (printed-ink, not neon/pastel/gradient, per the
        // brief's own house rules in design.ts), never reused for brand,
        // selection, or decoration. `DEFAULT` is the flat fill/text
        // color for each state; `soft` is a low-opacity tint for a
        // background chip/badge behind that same state's text.
        signal: {
          under: "#3FAE6B",
          "under-soft": "rgba(63, 174, 107, 0.12)",
          watch: "#D6A431",
          "watch-soft": "rgba(214, 164, 49, 0.12)",
          over: "#D85A4A",
          "over-soft": "rgba(216, 90, 74, 0.12)",
        },
      },
      fontFamily: {
        // Brief 6: self-hosted IBM Plex — see globals.css's @font-face
        // block and the CSS vars it defines. `mono` is for every rupee
        // figure and every digit in a table or counter (tabular figures,
        // so digits don't jitter mid-count — see CountUpNumber), never
        // for body text.
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      // Brief 6: no glow shadows — shadow-glow-primary/glow-cyan/glow-pink
      // are deleted outright, not re-tuned (they used to exist here).
      // Depth comes from surface value (the `card`/`card-border` tokens
      // above), not from bloom.
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
