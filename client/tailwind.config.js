/** @type {import('tailwindcss').Config} */

// Royal blue on cool paper, with a saffron accent used sparingly. `indigo` is an
// alias of the brand so older screens follow the same palette.
const brand = {
  50: "#eef3ff",
  100: "#dde7ff",
  150: "#cddbff",
  200: "#bdd0ff",
  300: "#91adff",
  400: "#6088ff",
  500: "#3d6cfb",
  600: "#2856f0",
  700: "#1d43d3",
  800: "#1c39a8",
  900: "#1b3185",
  950: "#101b4a",
};

const neutral = {
  50: "#f6f8fd",
  100: "#eef2fa",
  150: "#e8ecf6",
  200: "#e1e6f2",
  250: "#d5dbea",
  300: "#c3cbdd",
  400: "#848ea7",
  500: "#5d6781",
  600: "#46506b",
  700: "#2f3854",
  800: "#1b2342",
  900: "#0e1431",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand,
        indigo: brand,
        slate: neutral,
        saffron: { 100: "#fff1d1", 400: "#ffbe3d", 500: "#f5a00b", 700: "#9a5b00" },
      },
      fontFamily: {
        sans: ['"DM Sans Variable"', "system-ui", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px",
      },
      boxShadow: {
        sm: "0 1px 2px rgb(14 20 49 / 0.05)",
        md: "0 4px 14px -4px rgb(14 20 49 / 0.10)",
        lg: "0 12px 32px -10px rgb(14 20 49 / 0.16)",
        xl: "0 22px 54px -16px rgb(14 20 49 / 0.20)",
        "2xl": "0 34px 80px -22px rgb(14 20 49 / 0.30)",
        glow: "0 8px 22px -8px rgb(40 86 240 / 0.55)",
        inner: "none",
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "none" } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        pop: { from: { opacity: 0, transform: "translateY(8px) scale(0.95)" }, to: { opacity: 1, transform: "none" } },
        "slide-left": { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
        grow: { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
        widen: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        dot: { "0%, 60%, 100%": { transform: "none", opacity: 0.4 }, "30%": { transform: "translateY(-4px)", opacity: 1 } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        halo: { "0%": { boxShadow: "0 0 0 0 rgb(40 86 240 / 0.45)" }, "70%, 100%": { boxShadow: "0 0 0 14px rgb(40 86 240 / 0)" } },
        draw: { from: { strokeDashoffset: 1 }, to: { strokeDashoffset: 0 } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      // "backwards" leaves no transform behind, so dialogs inside stay fixed to the screen
      animation: {
        rise: "rise 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) backwards",
        fade: "fade 0.35s ease backwards",
        pop: "pop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.25) backwards",
        "slide-left": "slide-left 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) backwards",
        grow: "grow 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) backwards",
        widen: "widen 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) backwards",
        dot: "dot 1.2s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        halo: "halo 2.4s ease-out infinite",
        draw: "draw 1.1s 0.5s cubic-bezier(0.6, 0, 0.2, 1) backwards",
        marquee: "marquee 32s linear infinite",
      },
    },
  },
  plugins: [],
};
