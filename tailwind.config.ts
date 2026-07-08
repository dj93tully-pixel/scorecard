import type { Config } from "tailwindcss";

// NBC theme (ported from the golf-pool design system): near-black chrome,
// electric-blue accent, NBC-peacock gradient strip, green/red scores.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Themeable tokens resolve to CSS vars (see app/globals.css). The
        // DEFAULT theme's var values equal the hex shown in comments, so the
        // default look is unchanged. Colors used with Tailwind opacity
        // modifiers (e.g. bg-positive/15) bind as `rgb(var(--x) / <alpha>)`.
        // Dark chrome
        "header-bg": "var(--color-header)", // #0C0C0E
        "ticker-bg": "var(--color-ticker)", // #060608
        "on-dark": "#FFFFFF",
        "avatar-bg": "var(--color-chip)", // #1C1C22 — dark chips on the header
        "accent-on-dark": "var(--color-accent-on-dark)", // #6BA0FF — reads on near-black
        // Light body
        "page-bg": "var(--color-bg)", // #F5F6F8
        "card-bg": "var(--color-surface)", // #FFFFFF
        "surface-2": "var(--color-surface-2)", // #F4F6FA
        "card-border": "var(--color-border)", // #E5E7EB
        divider: "var(--color-divider)", // #EEF0F3
        "text-primary": "var(--color-text)", // #16181D
        "text-muted": "var(--color-muted)", // #8A90A0
        "text-faint": "var(--color-text-faint)", // #9098A4
        "row-tint": "var(--color-row-tint)", // #EDF3FF — soft blue team/highlight wash
        chevron: "#C4C8CE",
        // Accent
        primary: "rgb(var(--color-accent-rgb) / <alpha-value>)", // #2D78FF
        "accent-on-light": "var(--color-accent)", // #2D78FF
        alert: "var(--color-status)", // #F0524B — wolf / live red pop
        // Semantic scores (constant)
        positive: "rgb(var(--color-positive-rgb) / <alpha-value>)", // #2BC081
        negative: "rgb(var(--color-negative-rgb) / <alpha-value>)", // #F0524B
        "score-under": "#2BC081",
        "score-over": "#F0524B",
        "score-even": "#8A90A0",
        "pill-bg": "var(--color-pill-bg)", // #DDF6EC
        "pill-text": "rgb(var(--color-pill-text-rgb) / <alpha-value>)", // #0E7A5A
        // Row washes
        "tint-good": "#F0F9F4",
        "tint-caution": "#FEFAE6",
        "tint-bad": "#FEE3E3",
        // Leaderboard rank rail (blue gradient)
        "rank-1": "#1A4FB8",
        "rank-2": "#2D78FF",
        "rank-3": "#6BA0FF",
        "rank-4": "#AECBFF",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "Times", "serif"],
      },
      backgroundImage: {
        // Header underline strip — themeable via --color-strip. The DEFAULT
        // theme's var equals the original NBC-peacock rainbow gradient.
        "signature-gradient": "var(--color-strip)",
      },
      borderRadius: {
        // Themeable card corner radius (--radius-card). Default 12px == the
        // original `rounded-xl`, so cards using `rounded-card` are unchanged
        // under the default theme.
        card: "var(--radius-card)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "live-pulse": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        "skeleton-pulse": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "live-pulse": "live-pulse 2s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
