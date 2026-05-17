import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // DeGeldHeld brand: groen + wit
        brand: {
          // Slightly darkened from the previous emerald-derived ramp so
          // that bg-brand-600 + white text passes WCAG 2.1 AA (4.5:1).
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#0a8856",
          600: "#04785a",
          700: "#036b4d",
          800: "#034f3a",
          900: "#023a2a",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
      },
    },
  },
  plugins: [],
};
export default config;
