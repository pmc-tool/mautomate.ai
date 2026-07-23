/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,jsx,ts,tsx,mdx}",
  ],
  theme: {
    // The Figma canvas caps the desktop layout at 1440px.
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2.5rem",
      },
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        // Brand tokens pulled from the mAutomate design system.
        brand: {
          DEFAULT: "#F15A29",
          light: "#FF7A3D",
          dark: "#E24913",
          soft: "#FFF1EA",
        },
        ink: {
          DEFAULT: "#141414",
          soft: "#2B2B2B",
        },
        muted: {
          DEFAULT: "#6B6B6B",
          light: "#8A8A8A",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F6F6F6",
          card: "#FBFBFB",
        },
        line: "#ECECEC",
        accent: {
          green: "#2FB457",
          "green-light": "#4CD07A",
        },
      },
      fontFamily: {
        // Inter, loaded via next/font and exposed as the --font-inter CSS var.
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        // Type scale approximated from the Figma frame.
        "display": ["clamp(2.5rem, 5vw, 3.5rem)", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        "h2": ["clamp(1.75rem, 3.2vw, 2.5rem)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
      },
      maxWidth: {
        frame: "1440px",
      },
      boxShadow: {
        card: "0 12px 40px -18px rgba(20, 20, 20, 0.18)",
        "card-hover": "0 20px 60px -20px rgba(241, 90, 41, 0.28)",
        float: "0 24px 70px -24px rgba(20, 20, 20, 0.25)",
      },
      borderRadius: {
        xl2: "1.5rem",
        "3xl": "2rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "float-chip": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "spin-orbit": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        halo: {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(1)", opacity: "0.45" },
          "50%": { transform: "translate(-50%, -50%) scale(1.08)", opacity: "0.7" },
        },
        radar: {
          "0%": { transform: "translate(-50%, -50%) scale(0.55)", opacity: "0.45" },
          "100%": { transform: "translate(-50%, -50%) scale(1.5)", opacity: "0" },
        },
        progress: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        // Vertical text ticker: hold each line (1.25rem tall), then roll up to
        // the next; the 5th slot is a duplicate of the 1st so the loop is seamless.
        "text-roll": {
          "0%, 18%": { transform: "translateY(0)" },
          "25%, 43%": { transform: "translateY(-1.25rem)" },
          "50%, 68%": { transform: "translateY(-2.5rem)" },
          "75%, 93%": { transform: "translateY(-3.75rem)" },
          "100%": { transform: "translateY(-5rem)" },
        },
      },
      animation: {
        "float-slow": "float-slow 6s ease-in-out infinite",
        "float-chip": "float-chip 5s ease-in-out infinite",
        "spin-orbit": "spin-orbit 32s linear infinite",
        "spin-orbit-reverse": "spin-orbit 44s linear infinite reverse",
        halo: "halo 5s ease-in-out infinite",
        radar: "radar 3.6s ease-out infinite",
        "fade-up": "fade-up 0.4s ease both",
        progress: "progress var(--progress-duration, 5s) linear both",
        "text-roll": "text-roll 8s cubic-bezier(0.7, 0, 0.3, 1) infinite",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
