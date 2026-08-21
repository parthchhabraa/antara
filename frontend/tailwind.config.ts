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
        primary: {
          50: "#f5f3ff",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
        accent: {
          cyan: "#06b6d4",
          pink: "#ec4899",
          emerald: "#10b981",
          orange: "#f97316",
          amber: "#f59e0b",
        },
        // "Strain" redesign tokens (survey + future emerald/gold surfaces).
        // Additive only — existing violet/cyan pages are untouched.
        gold: {
          200: "#f2debb",
          300: "#e8c98c",
          400: "#dfb35f",
          500: "#d4a444",
          600: "#b3853a",
          700: "#8a6528",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        "glow-purple": "0 0 25px -5px rgba(139, 92, 246, 0.4)",
        "glow-cyan": "0 0 25px -5px rgba(6, 182, 212, 0.4)",
        "glow-pink": "0 0 25px -5px rgba(236, 72, 153, 0.4)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.4)",
        "glow-gold": "0 0 25px -6px rgba(212, 164, 68, 0.45)",
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
