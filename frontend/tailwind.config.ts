import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          surface: "var(--ink-surface)",
          elevated: "var(--ink-elevated)",
          border: "var(--ink-border)",
        },
        bone: {
          DEFAULT: "var(--bone)",
          muted: "var(--bone-muted)",
          subtle: "var(--bone-subtle)",
        },
        indigo: {
          DEFAULT: "var(--indigo)",
          hover: "var(--indigo-hover)",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["'Playfair Display'", "Didot", "Bodoni MT", "Cinzel", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
