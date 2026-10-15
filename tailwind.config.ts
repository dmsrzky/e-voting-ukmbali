import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1E1915",
        cream: "#FAF6EF",
        sand: "#EFE6D6",
        maroon: { DEFAULT: "#7A1F2B", dark: "#5E1621" },
        gold: { DEFAULT: "#C49A3C", soft: "#F3E6C4" },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
