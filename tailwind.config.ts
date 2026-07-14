import type { Config } from "tailwindcss";

// Tokens repris de stitch_country_guess_mobile_game/country_guess_system/DESIGN.md
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Palette de jeu (contrainte produit). Elle prime sur le dump de tokens
        // Stitch, qui se contredisait lui-même (tokens #f4fafd/#5341cd vs markup
        // en dur bg-[#FAFAF8]/bg-[#DFE6E9]). Le markup et le DESIGN.md disaient vrai.
        canvas: "#FAFAF8", // fond
        accent: "#6C5CE7", // action principale
        "accent-edge": "#4029ba", // arête 3D du bouton primaire
        success: "#00B894", // lettre trouvée
        danger: "#FF6B6B", // lettre absente / guess raté
        tile: "#DFE6E9", // tuile cachée
        "tile-edge": "#D1D8DB", // ombre portée des tuiles

        surface: "#FAFAF8",
        "surface-dim": "#d4dbde",
        "surface-bright": "#f4fafd",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eef5f8",
        "surface-container": "#e8eff2",
        "surface-container-high": "#e2e9ec",
        "surface-container-highest": "#dde4e7",
        "surface-variant": "#dde4e7",
        "surface-tint": "#5847d2",
        "on-surface": "#161d1f",
        "on-surface-variant": "#474554",
        "inverse-surface": "#2a3234",
        "inverse-on-surface": "#ebf2f5",
        outline: "#787586",
        "outline-variant": "#c8c4d7",
        primary: "#6C5CE7",
        "on-primary": "#ffffff",
        "primary-container": "#6c5ce7",
        "on-primary-container": "#faf6ff",
        "inverse-primary": "#c6bfff",
        "primary-fixed": "#e4dfff",
        "primary-fixed-dim": "#c6bfff",
        "on-primary-fixed": "#160066",
        "on-primary-fixed-variant": "#4029ba",
        secondary: "#006b55",
        "on-secondary": "#ffffff",
        "secondary-container": "#6dfad2",
        "on-secondary-container": "#00725b",
        "secondary-fixed": "#6dfad2",
        "secondary-fixed-dim": "#4bddb7",
        "on-secondary-fixed": "#002018",
        "on-secondary-fixed-variant": "#005140",
        tertiary: "#a62a30",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#c84245",
        "on-tertiary-container": "#fff5f4",
        "tertiary-fixed": "#ffdad8",
        "tertiary-fixed-dim": "#ffb3b0",
        "on-tertiary-fixed": "#410006",
        "on-tertiary-fixed-variant": "#8c1520",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        background: "#FAFAF8",
        "on-background": "#161d1f",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", fontWeight: "800", letterSpacing: "-0.02em" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "800", letterSpacing: "-0.01em" }],
        "headline-lg-mobile": ["28px", { lineHeight: "34px", fontWeight: "800" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "700" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "500" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "500" }],
        "label-lg": ["14px", { lineHeight: "20px", fontWeight: "700", letterSpacing: "0.05em" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
      },
      maxWidth: {
        container: "600px",
      },
      boxShadow: {
        // Level 1 / Level 2 du design system
        tile: "0 4px 0 0 #d1d8db",
        card: "0 4px 12px 0 rgb(22 29 31 / 0.10)",
        modal: "0 12px 32px 0 rgb(22 29 31 / 0.18)",
        "btn-3d": "0 4px 0 0 #4029ba",
      },
      keyframes: {
        // "Pop" 1.1x à la révélation d'une tuile (cf. DESIGN.md > Game Tiles).
        "tile-pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "tile-pop": "tile-pop 220ms ease-out",
        "slide-up": "slide-up 300ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
