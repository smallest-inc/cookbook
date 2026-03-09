/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          bg: "#0f0d0a",
          deep: "#1a1510",
          warm: "#231e16",
        },
        gold: {
          DEFAULT: "#c9a84c",
          dim: "#8b7635",
          bright: "#e0c060",
          glow: "rgba(201,168,76,0.35)",
        },
        olive: {
          DEFAULT: "#8b9d7a",
          dim: "#5e6d50",
          glow: "rgba(139,157,122,0.35)",
        },
        terracotta: "#d4956a",
        cream: "#e8dcc8",
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
