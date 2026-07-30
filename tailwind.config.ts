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
        // Dark chrome
        "header-bg": "#1B1407",
        "ticker-bg": "#060608",
        "on-dark": "#FFFFFF",
        "avatar-bg": "#1C1C22", // dark chips on the header
        "accent-on-dark": "#6BA0FF", // accent that reads on near-black
        // Light body
        "page-bg": "#F5F6F8",
        "card-bg": "#FFFFFF",
        "surface-2": "#F4F6FA",
        "card-border": "#E5E7EB",
        divider: "#EEF0F3",
        "text-primary": "#16181D",
        "text-muted": "#8A90A0",
        "text-faint": "#9098A4",
        "row-tint": "#EDF3FF", // soft blue team/highlight wash
        chevron: "#C4C8CE",
        // Accent
        primary: "#2D78FF", // NBC electric blue
        "accent-on-light": "#2D78FF",
        alert: "#F0524B", // wolf / live red pop
        // Semantic scores (constant)
        positive: "#2BC081",
        negative: "#F0524B",
        "score-under": "#2BC081",
        "score-over": "#F0524B",
        "score-even": "#8A90A0",
        "pill-bg": "#DDF6EC",
        "pill-text": "#0E7A5A",
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
        // Header underline strip — rainbow (NBC-peacock) gradient
        "signature-gradient":
          "linear-gradient(90deg,#fcb711,#f37021,#cc004c,#6460aa,#0089d0,#0db14b)",
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
