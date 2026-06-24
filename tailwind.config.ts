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
        brand: {
          50: "#f8fafc",
          100: "#eef2f7",
          200: "rgba(255, 255, 255, 0.18)",
          300: "rgba(255, 255, 255, 0.28)",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.06)",
          secondary: "rgba(255, 255, 255, 0.04)",
          tertiary: "rgba(255, 255, 255, 0.09)",
          card: "rgba(255, 255, 255, 0.1)",
        },
        ink: {
          DEFAULT: "#f1f5f9",
          secondary: "rgba(241, 245, 249, 0.78)",
          muted: "rgba(241, 245, 249, 0.42)",
        },
        accent: {
          gold: "#fbbf24",
          "gold-light": "#fcd34d",
          "gold-dark": "#f59e0b",
          emerald: "#34d399",
          rose: "#fb7185",
          purple: "#a78bfa",
          orange: "#fb923c",
          neon: "#c4b5fd",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 32px rgba(15, 23, 42, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        elevated: "0 16px 48px rgba(15, 23, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
        glow: "0 0 0 1px rgba(167, 139, 250, 0.35), 0 0 24px rgba(139, 92, 246, 0.25)",
        "glow-orange": "0 0 24px rgba(251, 146, 60, 0.35)",
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
