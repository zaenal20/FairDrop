/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: ["attribute", "data-theme"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Montserrat Alternates'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'Jetbrains Mono'", "monospace"],
      },
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        accent2: "#F97316",
        accent: "#2BF916",
        "accent-dim": "#7C3912",
        muted: "var(--color-muted)",
        text: "var(--color-text)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
    },
  },
  plugins: [],
};
