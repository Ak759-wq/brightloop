import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        brand: { 50: "#eef4ff", 100: "#dbe6ff", 200: "#bfd3ff", 300: "#93b4ff", 400: "#5f8bfb", 500: "#3a66f5", 600: "#1f4ae8", 700: "#1a3bd0", 800: "#1b33a8", 900: "#1c3184" },
        navy: { 700: "#1a2547", 800: "#121b36", 900: "#0b1226", 950: "#070c1a" },
        canvas: "#f3f6fb",
        ink: { DEFAULT: "#0f172a", muted: "#64748b", soft: "#94a3b8" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        lift: "0 8px 24px -8px rgba(31,74,232,0.25)",
      },
      borderRadius: { xl2: "1.25rem" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-in": "fade-in .18s ease-out" },
    },
  },
  plugins: [],
};
export default config;
