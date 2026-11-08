import localFont from "next/font/local";

export const manrope = localFont({
  src: "../assets/fonts/Manrope-Variable.ttf",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-manrope",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});
