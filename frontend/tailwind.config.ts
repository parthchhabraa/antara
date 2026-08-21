import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090C",
        card: "rgba(18, 20, 29, 0.75)",
        "card-border": "rgba(255, 255, 255, 0.08)",
        // Theme: violet/indigo as the primary brand color on the near-black
        // base, matching the original "Antara.dc.html" ("1a — Strain")
        // Claude Design mockup. Step 7 (2026-08-20) reverted this back from
        // an emerald/gold reskin — the emerald swap wasn't actually what was
        // wanted; the mockup's own colors are the source of truth.
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
        accent: {
          cyan: "#06b6d4",
          pink: "#ec4899",
          emerald: "#10b981",
          orange: "#f97316",
          amber: "#f59e0b",
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        "glow-primary": "0 0 25px -5px rgba(139, 92, 246, 0.4)",
        "glow-cyan": "0 0 25px -5px rgba(6, 182, 212, 0.4)",
        "glow-pink": "0 0 25px -5px rgba(236, 72, 153, 0.4)",
      },
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
