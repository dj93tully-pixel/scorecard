import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark chrome
        "header-bg": "#0A0E1C",
        "ticker-bg": "#060912",
        "on-dark": "#FFFFFF",
        "avatar-bg": "#18213A",
        "accent-on-dark": "#5A6DD0",
        // Light body
        "page-bg": "#F4F5F7",
        "card-bg": "#FFFFFF",
        "card-border": "#EAECEF",
        divider: "#EEF0F3",
        "text-primary": "#16181D",
        "text-muted": "#878D96",
        "text-faint": "#9098A4",
        "row-tint": "#E7EAF6",
        chevron: "#C4C8CE",
        // Accent
        primary: "#354CA1",
        "accent-on-light": "#2E4391",
        alert: "#CC0035",
        // Semantic (constant)
        positive: "#12B886",
        "pill-bg": "#D7F0E4",
        "pill-text": "#0E7A5A",
        negative: "#CC0035",
      },
      backgroundImage: {
        "signature-gradient":
          "linear-gradient(90deg, #354CA1 0%, #354CA1 32%, #CC0035 68%, #CC0035 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
