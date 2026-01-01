/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.ts"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: ["Overpass Mono", "monospace"],
        sans: ["Overpass", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        bg: {
          primary: "#FAFAFA",
          secondary: "#F0F0F0",
        },
        text: {
          primary: "#1A1A1A",
          secondary: "#666666",
        },
        accent: {
          DEFAULT: "#cd5c2e",
          hover: "#b34d22",
        },
        border: "#E5E5E5",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            color: "#1A1A1A",
            a: {
              color: "#cd5c2e",
              textDecoration: "none",
              backgroundImage: "linear-gradient(#cd5c2e, #cd5c2e)",
              backgroundSize: "0% 1px",
              backgroundPosition: "0 100%",
              backgroundRepeat: "no-repeat",
              transition: "background-size 0.3s ease, color 0.2s ease",
              "&:hover": {
                color: "#b34d22",
                backgroundSize: "100% 1px",
              },
            },
            h1: {
              fontFamily: "Overpass Mono, monospace",
              fontWeight: "500",
            },
            h2: {
              fontFamily: "Overpass Mono, monospace",
              fontWeight: "500",
            },
            h3: {
              fontFamily: "Overpass Mono, monospace",
              fontWeight: "500",
            },
            code: {
              fontFamily: "Overpass Mono, monospace",
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
