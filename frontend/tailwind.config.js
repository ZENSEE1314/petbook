/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Warm neutral — pairs with orange for cards & backgrounds
        cream: {
          50: "#fffbf5",
          100: "#fef5e7",
          200: "#fceedb",
        },
        // Sage accent — "healthy / nature" cues for guide + success states
        sage: {
          50: "#f3f8f4",
          100: "#e3eee5",
          200: "#c6ddcb",
          500: "#6a9775",
          600: "#4d7b5a",
          700: "#3e6449",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        "elev-1": "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
        "elev-2": "0 4px 6px -1px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
        "elev-3": "0 12px 24px -12px rgb(15 23 42 / 0.18)",
        "ring-brand": "0 0 0 3px rgb(249 115 22 / 0.2)",
      },
      borderRadius: {
        xl2: "1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 240ms ease-out",
      },
    },
  },
  plugins: [],
};
