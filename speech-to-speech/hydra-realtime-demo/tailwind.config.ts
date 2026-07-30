import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        mono: [
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        ink: {
          50: "oklch(0.9851 0 0)",
          100: "oklch(0.9851 0 0)",
          200: "oklch(0.9219 0 0)",
          300: "oklch(0.8480 0 0)",
          400: "oklch(0.7090 0 0)",
          500: "oklch(0.5555 0 0)",
          600: "oklch(0.4386 0 0)",
          700: "oklch(0.3715 0 0)",
          800: "oklch(0.2686 0 0)",
          900: "oklch(0.2134 0 0)",
          950: "oklch(0.1448 0 0)",
        },
        brand: {
          50: "oklch(0.9851 0 0)",
          100: "oklch(0.9219 0 0)",
          200: "oklch(0.8480 0 0)",
          300: "oklch(0.7090 0 0)",
          400: "oklch(0.5555 0 0)",
          500: "oklch(0.4386 0 0)",
          600: "oklch(0.3715 0 0)",
          700: "oklch(0.2686 0 0)",
          800: "oklch(0.2134 0 0)",
          900: "oklch(0.1448 0 0)",
        },
        accent: {
          400: "oklch(0.7090 0 0)",
          500: "oklch(0.5555 0 0)",
        },
      },
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
        full: "9999px",
      },
      animation: {
        "orb-pulse": "orb-pulse 2.2s ease-in-out infinite",
        "fade-in": "fade-in 0.2s ease-out",
      },
      keyframes: {
        "orb-pulse": {
          "0%,100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.03)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
